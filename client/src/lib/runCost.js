const MILLION = 1_000_000;

/** Map `${type}:${model}` → provider row with unit prices. */
export function buildProviderPriceIndex(providers) {
  const index = new Map();
  for (const p of providers ?? []) {
    const type = String(p.type ?? "").toLowerCase();
    const model = String(p.model ?? "").trim();
    if (!type || !model) continue;
    index.set(`${type}:${model}`, p);
  }
  return index;
}

function sumTurnMetric(turns, key) {
  let sum = 0;
  let hasAny = false;
  for (const t of turns ?? []) {
    const v = t[key];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) continue;
    sum += n;
    hasAny = true;
  }
  return hasAny ? sum : null;
}

function priceNum(provider, field) {
  const v = provider?.[field];
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Estimated run cost from per-turn usage + provider unit prices.
 * Returns null when no component can be priced (missing usage or prices).
 */
export function computeRunCost(run, priceIndex) {
  const turns = run?.turns ?? [];
  if (!turns.length || !priceIndex?.size) return null;

  const stt = priceIndex.get(`stt:${run.stt_model}`);
  const llm = priceIndex.get(`llm:${run.llm_model}`);
  const tts = priceIndex.get(`tts:${run.tts_model}`);

  let total = 0;
  let pricedAny = false;

  const sttSeconds = sumTurnMetric(turns, "stt_audio_duration_s");
  const sttRate = priceNum(stt, "input_unit_price");
  if (sttSeconds != null && sttRate != null) {
    total += (sttSeconds / 60) * sttRate;
    pricedAny = true;
  }

  const promptTokens = sumTurnMetric(turns, "llm_prompt_tokens");
  const inputRate = priceNum(llm, "input_unit_price");
  if (promptTokens != null && inputRate != null) {
    total += (promptTokens / MILLION) * inputRate;
    pricedAny = true;
  }

  const completionTokens = sumTurnMetric(turns, "llm_completion_tokens");
  const outputRate = priceNum(llm, "output_unit_price");
  if (completionTokens != null && outputRate != null) {
    total += (completionTokens / MILLION) * outputRate;
    pricedAny = true;
  }

  const ttsChars = sumTurnMetric(turns, "tts_char_count");
  const ttsRate = priceNum(tts, "input_unit_price");
  if (ttsChars != null && ttsRate != null) {
    total += (ttsChars / MILLION) * ttsRate;
    pricedAny = true;
  }

  return pricedAny ? total : null;
}

export function formatCost(cost) {
  if (cost == null || !Number.isFinite(cost)) return null;
  return `$${cost.toFixed(3)}`;
}
