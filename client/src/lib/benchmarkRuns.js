import { apiFetch } from "./api";

function avg(arr) {
  if (!arr.length) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function sortedP(arr, pct) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(Math.floor(s.length * pct), s.length - 1)];
}

function formatRecordedAt(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${day} ${h}:${mi}`;
}

/** Map GET /api/benchmark-runs row → UI run shape (latency only; cost/accuracy null). */
export function mapBenchmarkRun(row) {
  const turns = (row.turns ?? []).map((t) => ({
    stt: t.stt_latency_ms,
    llm: t.llm_latency_ms,
    tts: t.tts_latency_ms,
    e2e: t.e2e_latency_ms,
    stt_audio_duration_s:
      t.stt_audio_duration_s != null ? Number(t.stt_audio_duration_s) : null,
    llm_prompt_tokens:
      t.llm_prompt_tokens != null ? Number(t.llm_prompt_tokens) : null,
    llm_completion_tokens:
      t.llm_completion_tokens != null ? Number(t.llm_completion_tokens) : null,
    tts_char_count: t.tts_char_count != null ? Number(t.tts_char_count) : null,
  }));

  const stts = turns.map((t) => t.stt);
  const llms = turns.map((t) => t.llm);
  const ttss = turns.map((t) => t.tts);
  const e2es = turns.map((t) => t.e2e);

  const round = (n) => (n == null ? null : Math.round(n));

  return {
    id: row.id,
    started_at: formatRecordedAt(row.recorded_at),
    stt_provider: row.stt_provider_name,
    stt_model: row.stt_model,
    llm_provider: row.llm_provider_name,
    llm_model: row.llm_model,
    tts_provider: row.tts_provider_name,
    tts_model: row.tts_model,
    provider: row.llm_provider_name,
    model: row.llm_model,
    type: "llm",
    dataset: null,
    iterations: turns.length,
    status: turns.length > 0 ? "completed" : "completed",
    progress: 100,
    accuracy: null,
    cost: null,
    avg_stt_ms: round(avg(stts)),
    avg_llm_ms: round(avg(llms)),
    avg_tts_ms: round(avg(ttss)),
    avg_e2e_ms: round(avg(e2es)),
    p50_stt_ms: round(sortedP(stts, 0.5)),
    p50_llm_ms: round(sortedP(llms, 0.5)),
    p50_tts_ms: round(sortedP(ttss, 0.5)),
    p50_e2e_ms: round(sortedP(e2es, 0.5)),
    p95_e2e_ms: round(sortedP(e2es, 0.95)),
    p50: round(sortedP(e2es, 0.5)),
    p95: round(sortedP(e2es, 0.95)),
    turns,
  };
}

export async function fetchBenchmarkRuns() {
  const res = await apiFetch("/api/benchmark-runs");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || res.statusText || "Failed to load benchmark runs");
  }
  if (!Array.isArray(data)) return [];
  return data.map(mapBenchmarkRun);
}
