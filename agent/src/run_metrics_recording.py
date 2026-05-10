"""Per-session metrics written as **one JSON object per completed run**, appended to a single file.

Each time a session ends (close, job shutdown, or process exit), one compact JSON line is
appended to ``RUN_METRICS_DIR`` / ``RUN_METRICS_AGGREGATE_FILE`` (default ``run_metrics/metrics.ndjson``).
That file is **newline-delimited JSON** (NDJSON): each line is a full run document (same shape as
before when each run had its own ``.json`` file).

Parse with::

    import json
    with open("run_metrics/metrics.ndjson") as f:
        for line in f:
            run = json.loads(line)
"""

from __future__ import annotations

import atexit
import json
import logging
import os
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from livekit.agents import (
    AgentSession,
    CloseEvent,
    ConversationItemAddedEvent,
    JobContext,
    UserInputTranscribedEvent,
    UserStateChangedEvent,
)
from livekit.agents.llm import ChatMessage

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PipelineModels:
    """Inference model IDs configured on AgentSession (``provider/model`` form)."""

    stt_model_id: str
    llm_model_id: str
    tts_model_id: str


def _provider_from_model_id(model_id: str) -> str:
    if "/" in model_id:
        return model_id.split("/", 1)[0]
    return model_id


def _ms_from_seconds(value: float | None) -> float | None:
    if value is None:
        return None
    return round(value * 1000.0, 3)


def aggregate_metrics_path() -> Path:
    """Single append-only file (``RUN_METRICS_AGGREGATE_FILE`` under ``RUN_METRICS_DIR``)."""
    base = os.environ.get("RUN_METRICS_DIR", "run_metrics").strip()
    name = os.environ.get("RUN_METRICS_AGGREGATE_FILE", "metrics.ndjson").strip()
    root = Path(base).expanduser()
    root.mkdir(parents=True, exist_ok=True)
    return root / name


class RunMetricsRecorder:
    """Accumulate turns in memory; append one full JSON line per run when the session ends."""

    def __init__(
        self,
        *,
        path: Path,
        run_id: str,
        ctx: JobContext,
        models: PipelineModels,
    ) -> None:
        self._path = path
        self._run_id = run_id
        self._ctx = ctx
        self._models = models
        self._lock = threading.RLock()
        self._started_at_utc = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())
        self._turns: list[dict[str, Any]] = []
        self._written = False

        self._speech_start_mono: float | None = None
        self._stt_first_chunk_latency_sec: float | None = None
        self._pending_stt_ms: float | None = None

        atexit.register(self._atexit_flush)

    def on_user_state_changed(self, ev: UserStateChangedEvent) -> None:
        if ev.new_state == "speaking":
            self._speech_start_mono = time.perf_counter()
            self._stt_first_chunk_latency_sec = None

    def on_user_input_transcribed(self, ev: UserInputTranscribedEvent) -> None:
        stripped = (ev.transcript or "").strip()
        if not stripped:
            if ev.is_final:
                self._speech_start_mono = None
                self._stt_first_chunk_latency_sec = None
            return

        if (
            self._speech_start_mono is not None
            and self._stt_first_chunk_latency_sec is None
        ):
            self._stt_first_chunk_latency_sec = max(
                0.0, time.perf_counter() - self._speech_start_mono
            )

        if ev.is_final:
            if self._stt_first_chunk_latency_sec is not None:
                self._pending_stt_ms = round(
                    self._stt_first_chunk_latency_sec * 1000.0, 3
                )
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
            m = item.metrics
            if self._pending_stt_ms is None and m and m.get("transcription_delay") is not None:
                self._pending_stt_ms = _ms_from_seconds(m["transcription_delay"])
            return

        m = item.metrics or {}
        with self._lock:
            self._turns.append(
                {
                    "turn": len(self._turns) + 1,
                    "stt_latency_ms": self._pending_stt_ms,
                    "llm_latency_ms": _ms_from_seconds(m.get("llm_node_ttft")),
                    "tts_latency_ms": _ms_from_seconds(m.get("tts_node_ttfb")),
                    "e2e_latency_ms": _ms_from_seconds(m.get("e2e_latency")),
                }
            )
        self._pending_stt_ms = None

    def on_session_close(self, _ev: CloseEvent) -> None:
        self.flush()

    def flush(self) -> None:
        with self._lock:
            if self._written:
                return
            payload = self._payload_locked()
            line = json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
            with self._path.open("ab") as f:
                f.write(line.encode("utf-8"))
            self._written = True
        logger.info("Appended run metrics (one line) to %s", self._path.resolve())

    def _atexit_flush(self) -> None:
        if not self._written:
            self.flush()

    def _payload_locked(self) -> dict[str, Any]:
        m = self._models
        return {
            "schema_version": 1,
            "run_id": self._run_id,
            "room": self._ctx.room.name,
            "job_id": self._ctx.job.id,
            "started_at_utc": self._started_at_utc,
            "stt_provider": _provider_from_model_id(m.stt_model_id),
            "llm_provider": _provider_from_model_id(m.llm_model_id),
            "tts_provider": _provider_from_model_id(m.tts_model_id),
            "models": {
                "stt": m.stt_model_id,
                "llm": m.llm_model_id,
                "tts": m.tts_model_id,
            },
            "latency_units": "milliseconds",
            "latency_definitions": {
                "stt_latency_ms": (
                    "First transcript after user_state speaking (approx); "
                    "if missing, LiveKit user ChatMessage transcription_delay (post end-of-speech)."
                ),
                "llm_latency_ms": "llm_node_ttft (time to first LLM token)",
                "tts_latency_ms": "tts_node_ttfb (time to first TTS audio chunk)",
                "e2e_latency_ms": (
                    "User stopped speaking to agent started speaking (assistant metrics)"
                ),
            },
            "turns": list(self._turns),
        }


def _metrics_enabled() -> bool:
    v = os.environ.get("RUN_METRICS_DISABLE", "").strip().lower()
    return v not in ("1", "true", "yes")


def attach_run_metrics_recording(
    session: AgentSession,
    ctx: JobContext,
    models: PipelineModels,
) -> None:
    if not _metrics_enabled():
        return

    run_id = os.environ.get("RUN_METRICS_RUN_ID", "").strip()
    if not run_id:
        run_id = f"{ctx.job.id}_{time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())}"

    path = aggregate_metrics_path()
    recorder = RunMetricsRecorder(path=path, run_id=run_id, ctx=ctx, models=models)

    session.on("user_state_changed", recorder.on_user_state_changed)
    session.on("user_input_transcribed", recorder.on_user_input_transcribed)
    session.on("conversation_item_added", recorder.on_conversation_item_added)
    session.on("close", recorder.on_session_close)

    async def _on_shutdown(_reason: str = "") -> None:
        recorder.flush()

    ctx.add_shutdown_callback(_on_shutdown)

    logger.info(
        "Run metrics will append to %s (run_id=%s)",
        path.resolve(),
        run_id,
    )
