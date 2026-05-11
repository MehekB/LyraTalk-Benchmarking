// data/constants.js
// ─────────────────────────────────────────────────────────────────────────────
// All static reference data + real benchmark seed data from collected runs.
// ─────────────────────────────────────────────────────────────────────────────

/** Providers available per type in the Benchmark config dropdowns. */
export const PROVIDERS_BY_TYPE = {
  llm: [
    { name: 'GPT-5.2',          model: 'openai/gpt-5.2-chat-latest' },
    { name: 'Gemini 2.5 Flash', model: 'google/gemini-2.5-flash' },
    { name: 'Grok 4.1 Fast',    model: 'xai/grok-4-1-fast-non-reasoning' },
  ],
  stt: [
    { name: 'Deepgram Nova-3',  model: 'deepgram/nova-3' },
  ],
  tts: [
    { name: 'Cartesia Sonic-3', model: 'cartesia/sonic-3' },
  ],
};

/** Test datasets available per type in the Benchmark config dropdowns. */
export const DATASETS_BY_TYPE = {
  llm: ['MT-Bench QA', 'ToolBench Tasks', 'MMLU Subset'],
  stt: ['LibriSpeech Clean', 'Common Voice EN', 'Noisy Call Center'],
  tts: ['VCTK Sentences', 'LJSpeech Samples', 'Custom Prompts'],
};

/** Chart fill colors — purple palette to match the wireframe. */
export const CHART_COLORS = ['#7C6FCD', '#9B8FE0', '#B8AFF0', '#6B5FBD', '#5047A0'];

/** Seed data for the Providers table on first load.
 *  Only providers actually used in the 3 collected benchmark runs. */
export const INITIAL_PROVIDERS = [
  { id: 1, name: 'Deepgram Nova-3',  type: 'stt', model: 'deepgram/nova-3' },
  { id: 2, name: 'OpenAI GPT-5.2',   type: 'llm', model: 'openai/gpt-5.2-chat-latest' },
  { id: 3, name: 'Google Gemini 2.5 Flash', type: 'llm', model: 'google/gemini-2.5-flash' },
  { id: 4, name: 'xAI Grok 4.1 Fast', type: 'llm', model: 'xai/grok-4-1-fast-non-reasoning' },
  { id: 5, name: 'Cartesia Sonic-3', type: 'tts', model: 'cartesia/sonic-3' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Real benchmark data from 3 collected runs (May 10, 2026).
// STT = Deepgram nova-3, TTS = Cartesia sonic-3 across all runs.
// LLM varies: OpenAI gpt-5.2 | Google gemini-2.5-flash | xAI grok-4-1-fast
// ─────────────────────────────────────────────────────────────────────────────

function avg(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
function sortedP(arr, pct) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(Math.floor(s.length * pct), s.length - 1)];
}

const RAW_RUNS = [
  {
    id: 1,
    run_id: 'mock-job-cd8113fb6cb2',
    started_at: '2026-05-10 00:37',
    llm_provider: 'OpenAI',
    llm_model: 'openai/gpt-5.2-chat-latest',
    cost: 0.004,
    turns: [
      { stt: 97.698,   llm: 4634.265, tts: 261.768,  e2e: 5220.398 },
      { stt: 3663.744, llm: 1493.004, tts: 643.604,  e2e: 2724.450 },
      { stt: 107.600,  llm: 2553.471, tts: 1188.233, e2e: 6821.517 },
    ],
  },
  {
    id: 2,
    run_id: 'mock-job-09174dcc0193',
    started_at: '2026-05-10 00:40',
    llm_provider: 'Google',
    llm_model: 'google/gemini-2.5-flash',
    cost: 0.002,
    turns: [
      { stt: 901.681,  llm: 1542.901, tts: 326.918, e2e: 2122.393 },
      { stt: 176.611,  llm: 1706.738, tts: 438.455, e2e: 2521.153 },
      { stt: 1109.287, llm: 1744.101, tts: 559.421, e2e: 2622.405 },
    ],
  },
  {
    id: 3,
    run_id: 'mock-job-532742c0ce16',
    started_at: '2026-05-10 00:45',
    llm_provider: 'xAI',
    llm_model: 'xai/grok-4-1-fast-non-reasoning',
    cost: 0.003,
    turns: [
      { stt: 812.703, llm: 1571.705, tts: 294.342, e2e: 2126.226 },
      { stt: 793.636, llm: 1040.266, tts: 376.870, e2e: 1728.243 },
      { stt: 610.707, llm: 1937.167, tts: 367.857, e2e: 2823.666 },
    ],
  },
];

// Enrich each raw run with derived stats
export const INITIAL_RUNS = RAW_RUNS.map(r => {
  const stts = r.turns.map(t => t.stt);
  const llms = r.turns.map(t => t.llm);
  const ttss = r.turns.map(t => t.tts);
  const e2es = r.turns.map(t => t.e2e);
  return {
    // identity
    id:          r.id,
    run_id:      r.run_id,
    started_at:  r.started_at,
    // provider metadata
    stt_provider: 'Deepgram', stt_model: 'deepgram/nova-3',
    llm_provider:  r.llm_provider, llm_model: r.llm_model,
    tts_provider: 'Cartesia', tts_model: 'cartesia/sonic-3',
    // legacy fields used by BenchmarkRunsTable / existing state shape
    provider: r.llm_provider, model: r.llm_model,
    type: 'llm', dataset: 'Voice pipeline', iterations: r.turns.length,
    status: 'completed', progress: 100, accuracy: null,
    cost: r.cost,
    // per-component averages (ms, rounded)
    avg_stt_ms: Math.round(avg(stts)),
    avg_llm_ms: Math.round(avg(llms)),
    avg_tts_ms: Math.round(avg(ttss)),
    avg_e2e_ms: Math.round(avg(e2es)),
    // p50 values
    p50_stt_ms: Math.round(sortedP(stts, 0.5)),
    p50_llm_ms: Math.round(sortedP(llms, 0.5)),
    p50_tts_ms: Math.round(sortedP(ttss, 0.5)),
    p50_e2e_ms: Math.round(sortedP(e2es, 0.5)),
    p95_e2e_ms: Math.round(sortedP(e2es, 0.95)),
    // legacy aliases
    p50: Math.round(sortedP(e2es, 0.5)),
    p95: Math.round(sortedP(e2es, 0.95)),
    // raw turns preserved for the per-turn line chart
    turns: r.turns,
  };
});

/** The most recent completed run — shown in the Dashboard "Latest Run" bar. */
export const LATEST_RUN = INITIAL_RUNS[INITIAL_RUNS.length - 1];