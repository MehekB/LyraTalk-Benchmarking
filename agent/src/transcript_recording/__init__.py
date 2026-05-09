"""Session transcript file recording (streaming STT + streaming assistant text).

STT "first text" latency (``stt_first_text_latency``) is measured as *wall time* from when the
session reports the user as *speaking* (``user_state_changed`` → ``speaking``) until the first
non-empty ``user_input_transcribed`` event for that utterance. That approximates
*speech detected → first transcript characters*, not the raw HTTP/WebSocket handshake inside the
STT provider (those internals are not exposed here).

For **P50/P90/P95** or RTF-style summaries, run many sessions or utterances and aggregate the
``stt_first_text_latency`` lines (or export samples to CSV in a separate benchmark harness).
"""

from __future__ import annotations

import logging
import os
import threading
import time
from pathlib import Path

try:
    import fcntl
except ImportError:
    fcntl = None  # Windows: no flock; counter uses threading lock only

from livekit.agents import (
    AgentSession,
    ConversationItemAddedEvent,
    JobContext,
    UserInputTranscribedEvent,
    UserStateChangedEvent,
)
from livekit.agents.llm import ChatMessage

__all__ = [
    "StreamingTranscriptWriter",
    "attach_streaming_transcript",
    "transcript_file_path",
]

logger = logging.getLogger(__name__)

_sequence_lock = threading.Lock()


def _fmt_seconds_as_ms(seconds: float) -> str:
    return f"{seconds * 1000.0:.1f}ms"


def _assistant_latency_lines(item: ChatMessage) -> str | None:
    """Format e2e, LLM TTFT, TTS TTFB from LiveKit MetricsReport (assistant turns only)."""
    m = item.metrics
    if not m:
        return None
    parts: list[str] = []
    if m.get("e2e_latency") is not None:
        parts.append(f"e2e_latency={_fmt_seconds_as_ms(m['e2e_latency'])}")
    if m.get("llm_node_ttft") is not None:
        parts.append(f"llm_ttft={_fmt_seconds_as_ms(m['llm_node_ttft'])}")
    if m.get("tts_node_ttfb") is not None:
        parts.append(f"tts_ttfb={_fmt_seconds_as_ms(m['tts_node_ttfb'])}")
    if not parts:
        return None
    return "Latencies: " + ", ".join(parts) + "\n\n"


def _max_numeric_transcript_stem(root: Path) -> int:
    """Highest N among ``N.txt`` files so new sessions do not collide after adopting numeric names."""
    if not root.is_dir():
        return 0
    highest = 0
    for path in root.glob("[0-9]*.txt"):
        stem = path.stem
        if stem.isdigit():
            highest = max(highest, int(stem))
    return highest


def _next_transcript_sequence(root: Path) -> int:
    """Monotonic 1-based sequence for filenames (cross-process safe on POSIX via flock)."""

    def read_bump_write() -> int:
        counter_path = root / ".transcript_sequence"
        if counter_path.exists():
            try:
                n = int(counter_path.read_text(encoding="utf-8").strip() or "0")
            except ValueError:
                n = _max_numeric_transcript_stem(root)
        else:
            n = _max_numeric_transcript_stem(root)
        n += 1
        counter_path.write_text(str(n), encoding="utf-8")
        return n

    lock_path = root / ".transcript_sequence.lock"
    if fcntl is not None:
        root.mkdir(parents=True, exist_ok=True)
        lock_path.touch(exist_ok=True)
        with lock_path.open("rb+") as lf:
            fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
            try:
                return read_bump_write()
            finally:
                fcntl.flock(lf.fileno(), fcntl.LOCK_UN)

    with _sequence_lock:
        root.mkdir(parents=True, exist_ok=True)
        return read_bump_write()


def transcript_file_path(_ctx: JobContext) -> Path:
    base_dir = os.environ.get("TRANSCRIPT_DIR", "transcripts").strip()
    root = Path(base_dir).expanduser()
    seq = _next_transcript_sequence(root)
    # Zero-padded so lexical sort matches chronological order (000001, 000002, …).
    return root / f"{seq:06d}.txt"


class StreamingTranscriptWriter:
    """Append transcript rows incrementally (streaming STT + streaming assistant text).

    All writes use UTF-8 bytes so partial user-turn truncation stays correct for any script.
    """

    def __init__(self, path: Path) -> None:
        self.path = path
        self.lock = threading.Lock()
        self._user_turn_byte_offset: int | None = None
        self._last_final_user_text: str | None = None
        self._assistant_stream_started = False
        # STT: first non-empty transcript after VAD reports "speaking" (see module docstring).
        self._speech_start_mono: float | None = None
        self._stt_first_chunk_latency_sec: float | None = None

    def on_user_state_changed(self, ev: UserStateChangedEvent) -> None:
        if ev.new_state == "speaking":
            self._speech_start_mono = time.perf_counter()
            self._stt_first_chunk_latency_sec = None

    def append_assistant_delta(self, delta: str) -> None:
        """Append one transcription chunk while the LLM stream / transcription pipeline runs."""
        if not isinstance(delta, str) or not delta:
            return
        raw = delta.encode()
        with self.lock, self.path.open("ab") as f:
            if not self._assistant_stream_started:
                # Blank line after label so turns never run together if user speaks mid-stream.
                f.write(b"Assistant:\n\n")
                self._assistant_stream_started = True
            f.write(raw)

    def on_user_input_transcribed(self, ev: UserInputTranscribedEvent) -> None:
        stripped = (ev.transcript or "").strip()
        if not stripped:
            if ev.is_final:
                self._last_final_user_text = None
                self._user_turn_byte_offset = None
                self._speech_start_mono = None
                self._stt_first_chunk_latency_sec = None
            return

        chunk = ev.transcript.encode()
        final_nl = b"\n\n"

        if (
            self._speech_start_mono is not None
            and self._stt_first_chunk_latency_sec is None
        ):
            self._stt_first_chunk_latency_sec = max(
                0.0, time.perf_counter() - self._speech_start_mono
            )

        with self.lock, self.path.open("rb+") as f:
            if self._user_turn_byte_offset is None:
                f.seek(0, 2)
                # User started while assistant text had no trailing paragraph break yet.
                if self._assistant_stream_started:
                    f.write(b"\n\n")
                f.write(b"You:\n")
                self._user_turn_byte_offset = f.tell()
            else:
                f.seek(self._user_turn_byte_offset)
                f.truncate()
            f.write(chunk)
            if ev.is_final:
                f.write(final_nl)
                if self._stt_first_chunk_latency_sec is not None:
                    stt_line = (
                        "stt_first_text_latency="
                        f"{_fmt_seconds_as_ms(self._stt_first_chunk_latency_sec)} "
                        "(user speaking → first transcript chunk)\n\n"
                    )
                    f.write(stt_line.encode("utf-8"))
                self._user_turn_byte_offset = None
                self._last_final_user_text = stripped
                self._speech_start_mono = None
                self._stt_first_chunk_latency_sec = None

    def on_conversation_item_added(self, ev: ConversationItemAddedEvent) -> None:
        item = ev.item
        if not isinstance(item, ChatMessage):
            return
        if item.role not in ("user", "assistant"):
            return

        text = (item.text_content or "").strip()

        if item.role == "user":
            if not text:
                return
            if text == self._last_final_user_text:
                return
            block = f"You:\n{text}\n\n".encode()
            with self.lock, self.path.open("ab") as f:
                if self._assistant_stream_started:
                    f.write(b"\n\n")
                f.write(block)
            self._last_final_user_text = text
            return

        interrupted = item.interrupted
        if self._assistant_stream_started:
            suffix = " (interrupted)" if interrupted else ""
            tail = f"{suffix}\n\n".encode()
            lat = _assistant_latency_lines(item)
            out = tail + (lat.encode("utf-8") if lat else b"")
            with self.lock, self.path.open("ab") as f:
                f.write(out)
            self._assistant_stream_started = False
            return

        if not text:
            return
        suffix = " (interrupted)" if interrupted else ""
        block = f"Assistant:{suffix}\n\n{text}\n\n"
        lat = _assistant_latency_lines(item)
        if lat:
            block += lat
        with self.lock, self.path.open("ab") as f:
            f.write(block.encode("utf-8"))


def attach_streaming_transcript(
    session: AgentSession, ctx: JobContext, writer: StreamingTranscriptWriter
) -> None:
    header = (
        "# Session transcript\n"
        f"# room={ctx.room.name!r}\n"
        f"# job_id={ctx.job.id!r}\n"
        f"# started_utc={time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime())}\n"
        "# After each user turn (streaming STT): stt_first_text_latency (speech→first chunk).\n"
        "# After each assistant turn: Latencies: e2e_latency, llm_ttft, tts_ttfb (LiveKit MetricsReport).\n\n"
    ).encode()
    with writer.path.open("wb") as f:
        f.write(header)

    session.on("user_state_changed", writer.on_user_state_changed)
    session.on("user_input_transcribed", writer.on_user_input_transcribed)
    session.on(
        "conversation_item_added",
        writer.on_conversation_item_added,
    )
    logger.info("Streaming transcript to %s", writer.path.resolve())
