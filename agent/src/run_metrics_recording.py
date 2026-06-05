"""Per-session metrics persisted when a run ends.

On flush, metrics are **POSTed** to the benchmark API (``BENCHMARK_API_URL`` or
``BENCHMARK_API_BASE`` + ``/api/benchmark-runs``), which inserts ``benchmark_runs`` /
``benchmark_turns`` in Postgres. Provider foreign keys are resolved server-side from
``providers.model`` (e.g. ``deepgram/nova-3``).

Optionally, the same payload is appended as one NDJSON line under ``RUN_METRICS_DIR`` when
``RUN_METRICS_NDJSON`` is enabled (default ``metrics.ndjson`` path unchanged).
"""

from __future__ import annotations

import atexit
import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
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


def _benchmark_api_url() -> str:
    explicit = os.environ.get("BENCHMARK_API_URL", "").strip()
    if explicit:
        return explicit.rstrip("/")
    base = os.environ.get("BENCHMARK_API_BASE", "http://127.0.0.1:3001").strip()
    return f"{base.rstrip('/')}/api/benchmark-runs"


def _api_enabled() -> bool:
    v = os.environ.get("BENCHMARK_API_DISABLE", "").strip().lower()
    return v not in ("1", "true", "yes")


def _ndjson_enabled() -> bool:
    v = os.environ.get("RUN_METRICS_NDJSON", "").strip().lower()
    return v in ("1", "true", "yes")


def _turns_for_api(turns: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Turns with all latency fields set (required by benchmark_turns NOT NULL)."""
    out: list[dict[str, Any]] = []
    for t in turns:
        stt = t.get("stt_latency_ms")
        llm = t.get("llm_latency_ms")
        tts = t.get("tts_latency_ms")
        e2e = t.get("e2e_latency_ms")
        if stt is None or llm is None or tts is None or e2e is None:
            continue
        turn: dict[str, Any] = {
            "turn_number":    t.get("turn", len(out) + 1),
            "stt_latency_ms": stt,
            "llm_latency_ms": llm,
            "tts_latency_ms": tts,
            "e2e_latency_ms": e2e,
        }
        # ── NEW: cost-related fields (nullable — include only when present) ──
        if t.get("stt_audio_duration_s") is not None:
            turn["stt_audio_duration_s"] = t["stt_audio_duration_s"]
        if t.get("llm_prompt_tokens") is not None:
            turn["llm_prompt_tokens"] = t["llm_prompt_tokens"]
        if t.get("llm_completion_tokens") is not None:
            turn["llm_completion_tokens"] = t["llm_completion_tokens"]
        if t.get("tts_char_count") is not None:
            turn["tts_char_count"] = t["tts_char_count"]
        out.append(turn)
    return out


def post_benchmark_run(
    *,
    stt_model: str,
    llm_model: str,
    tts_model: str,
    turns: list[dict[str, Any]],
    recorded_at: datetime | None = None,
    api_url: str | None = None,
    timeout_sec: float = 15.0,
) -> dict[str, Any]:
    """POST one completed run to the server; returns parsed JSON body."""
    complete = _turns_for_api(turns)
    if not complete:
        raise ValueError("No turns with complete latency metrics to persist")

    when = recorded_at or datetime.now(timezone.utc)
    body = {
        "recorded_at": when.isoformat(),
        "stt_model": stt_model,
        "llm_model": llm_model,
        "tts_model": tts_model,
        "turns": complete,
    }
    url = (api_url or _benchmark_api_url()).rstrip("/")
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Benchmark API {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Benchmark API unreachable at {url}: {e.reason}") from e


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

        # ── NEW: STT audio duration accumulated from user ChatMessage metrics ──
        self._pending_stt_audio_duration_s: float | None = None
        self._pending_llm_prompt_tokens:     int | None = None
        self._pending_llm_completion_tokens: int | None = None

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

    def on_llm_metrics_collected(self, metrics) -> None:
        # Fires after each LLM response — store tokens so on_conversation_item_added
        # can pick them up when the assistant ChatMessage is finalized
        self._pending_llm_prompt_tokens     = metrics.prompt_tokens
        self._pending_llm_completion_tokens = metrics.completion_tokens

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
            print("User ChatMessage metrics:", m)
            if self._pending_stt_ms is None and m and m.get("transcription_delay") is not None:
                self._pending_stt_ms = _ms_from_seconds(m["transcription_delay"])

            # Read audio duration before returning
            started  = m.get("started_speaking_at")
            stopped  = m.get("stopped_speaking_at")
            if started is not None and stopped is not None:
                self._pending_stt_audio_duration_s = round(float(stopped) - float(started), 3)

            return

        m = item.metrics or {}

        # ── NEW: TTS char count — length of the text sent to TTS this turn ───
        tts_char_count: int | None = len(text) if text else None
 
        # ── NEW: LLM token counts from assistant metrics ──────────────────────
        # LiveKit exposes these as llm_input_tokens / llm_output_tokens.
        llm_prompt_tokens     = self._pending_llm_prompt_tokens
        llm_completion_tokens = self._pending_llm_completion_tokens

        print("STT AUDIO DURATION:", self._pending_stt_audio_duration_s)
        print("TTS CHAR COUNT:", tts_char_count)
        print("LLM PROMPT TOKENS:", llm_prompt_tokens)
        print("LLM COMPLETION TOKENS:", llm_completion_tokens)


        with self._lock:
            self._turns.append(
                {
                    "turn":           len(self._turns) + 1,
                    # existing latency fields
                    "stt_latency_ms": self._pending_stt_ms,
                    "llm_latency_ms": _ms_from_seconds(m.get("llm_node_ttft")),
                    "tts_latency_ms": _ms_from_seconds(m.get("tts_node_ttfb")),
                    "e2e_latency_ms": _ms_from_seconds(m.get("e2e_latency")),
                    # ── NEW: cost-related fields ──────────────────────────────
                    "stt_audio_duration_s":  self._pending_stt_audio_duration_s,
                    "llm_prompt_tokens":     llm_prompt_tokens,
                    "llm_completion_tokens": llm_completion_tokens,
                    "tts_char_count":        tts_char_count,
                }
            )

        self._pending_stt_ms = None
        self._pending_stt_audio_duration_s = None  # NEW
        self._pending_llm_prompt_tokens     = None  # ← add
        self._pending_llm_completion_tokens = None  # ← add
        

    def on_session_close(self, _ev: CloseEvent) -> None:
        self.flush()

    def flush(self) -> None:
        with self._lock:
            if self._written:
                return
            payload = self._payload_locked()
            m = self._models
            persisted = False
            if _api_enabled():
                try:
                    result = post_benchmark_run(
                        stt_model=m.stt_model_id,
                        llm_model=m.llm_model_id,
                        tts_model=m.tts_model_id,
                        turns=payload["turns"],
                    )
                    persisted = True
                    logger.info(
                        "Persisted benchmark run to Postgres (id=%s)",
                        result.get("id"),
                    )
                except (ValueError, RuntimeError) as e:
                    logger.warning("Benchmark API POST failed: %s", e)
            if _ndjson_enabled():
                line = (
                    json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
                    + "\n"
                )
                with self._path.open("ab") as f:
                    f.write(line.encode("utf-8"))
                persisted = True
                logger.info("Appended run metrics (one line) to %s", self._path.resolve())
            if not persisted:
                logger.warning(
                    "Run metrics not persisted (enable API or RUN_METRICS_NDJSON=1)"
                )
                return
            self._written = True

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
                # ── NEW ──────────────────────────────────────────────────────
                "stt_audio_duration_s":  "Audio duration (seconds) reported by STT provider per turn",
                "llm_prompt_tokens":     "Input tokens sent to LLM (llm_input_tokens) per turn",
                "llm_completion_tokens": "Output tokens generated by LLM (llm_output_tokens) per turn",
                "tts_char_count":        "Character count of text sent to TTS per turn",
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
    session.llm.on("metrics_collected", recorder.on_llm_metrics_collected)
    session.on("close", recorder.on_session_close)

    async def _on_shutdown(_reason: str = "") -> None:
        recorder.flush()

    ctx.add_shutdown_callback(_on_shutdown)

    targets = []
    if _api_enabled():
        targets.append(_benchmark_api_url())
    if _ndjson_enabled():
        targets.append(str(path.resolve()))
    logger.info(
        "Run metrics on flush → %s (run_id=%s)",
        ", ".join(targets) if targets else "disabled",
        run_id,
    )
