import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from run_metrics_recording import (
    PipelineModels,
    _turns_for_api,
    post_benchmark_run,
)


def test_turns_for_api_skips_incomplete() -> None:
    turns = [
        {"turn": 1, "stt_latency_ms": 1.0, "llm_latency_ms": 2.0, "tts_latency_ms": 3.0, "e2e_latency_ms": 4.0},
        {"turn": 2, "stt_latency_ms": 1.0, "llm_latency_ms": None, "tts_latency_ms": 3.0, "e2e_latency_ms": 4.0},
    ]
    assert len(_turns_for_api(turns)) == 1
    assert _turns_for_api(turns)[0]["turn_number"] == 1


def test_turns_for_api_includes_usage_metrics_when_present() -> None:
    turns = [
        {
            "turn": 1,
            "stt_latency_ms": 1.0,
            "llm_latency_ms": 2.0,
            "tts_latency_ms": 3.0,
            "e2e_latency_ms": 4.0,
            "stt_audio_duration_s": 1.5,
            "llm_prompt_tokens": 100,
            "llm_completion_tokens": 50,
            "tts_char_count": 200,
        },
    ]
    out = _turns_for_api(turns)[0]
    assert out["stt_audio_duration_s"] == 1.5
    assert out["llm_prompt_tokens"] == 100
    assert out["llm_completion_tokens"] == 50
    assert out["tts_char_count"] == 200


def test_post_benchmark_run_sends_models_and_timestamp() -> None:
    recorded = datetime(2026, 5, 18, 12, 0, 0, tzinfo=timezone.utc)
    turns = [
        {"turn": 1, "stt_latency_ms": 10.0, "llm_latency_ms": 20.0, "tts_latency_ms": 30.0, "e2e_latency_ms": 40.0},
    ]
    response_body = json.dumps({"id": 42}).encode("utf-8")
    mock_resp = MagicMock()
    mock_resp.read.return_value = response_body
    mock_resp.__enter__ = lambda self: self
    mock_resp.__exit__ = MagicMock(return_value=False)

    with patch("run_metrics_recording.urllib.request.urlopen", return_value=mock_resp) as open_mock:
        result = post_benchmark_run(
            stt_model="deepgram/nova-3",
            llm_model="openai/gpt-5.2-chat-latest",
            tts_model="cartesia/sonic-3",
            turns=turns,
            recorded_at=recorded,
            api_url="http://test/api/benchmark-runs",
        )

    assert result == {"id": 42}
    req = open_mock.call_args[0][0]
    assert req.full_url == "http://test/api/benchmark-runs"
    body = json.loads(req.data.decode("utf-8"))
    assert body["recorded_at"] == recorded.isoformat()
    assert body["stt_model"] == "deepgram/nova-3"
    assert body["llm_model"] == "openai/gpt-5.2-chat-latest"
    assert body["tts_model"] == "cartesia/sonic-3"
    assert body["turns"][0]["e2e_latency_ms"] == 40.0


def test_post_benchmark_run_includes_usage_metrics_in_body() -> None:
    turns = [
        {
            "turn": 1,
            "stt_latency_ms": 10.0,
            "llm_latency_ms": 20.0,
            "tts_latency_ms": 30.0,
            "e2e_latency_ms": 40.0,
            "stt_audio_duration_s": 2.25,
            "llm_prompt_tokens": 120,
            "llm_completion_tokens": 80,
            "tts_char_count": 450,
        },
    ]
    response_body = json.dumps({"id": 1}).encode("utf-8")
    mock_resp = MagicMock()
    mock_resp.read.return_value = response_body
    mock_resp.__enter__ = lambda self: self
    mock_resp.__exit__ = MagicMock(return_value=False)

    with patch("run_metrics_recording.urllib.request.urlopen", return_value=mock_resp) as open_mock:
        post_benchmark_run(
            stt_model="deepgram/nova-3",
            llm_model="openai/gpt-5.2-chat-latest",
            tts_model="cartesia/sonic-3",
            turns=turns,
            api_url="http://test/api/benchmark-runs",
        )

    body = json.loads(open_mock.call_args[0][0].data.decode("utf-8"))
    turn = body["turns"][0]
    assert turn["stt_audio_duration_s"] == 2.25
    assert turn["llm_prompt_tokens"] == 120
    assert turn["llm_completion_tokens"] == 80
    assert turn["tts_char_count"] == 450


def test_post_benchmark_run_requires_complete_turns() -> None:
    with pytest.raises(ValueError, match="No turns"):
        post_benchmark_run(
            stt_model="a",
            llm_model="b",
            tts_model="c",
            turns=[{"turn": 1, "stt_latency_ms": 1.0}],
            api_url="http://test/api/benchmark-runs",
        )


def test_pipeline_models_frozen() -> None:
    m = PipelineModels(stt_model_id="s", llm_model_id="l", tts_model_id="t")
    assert m.llm_model_id == "l"
