// All static reference data used across the app.
// Modify to come from the database / API.


/** Providers available per type in the Benchmark config dropdowns. */
export const PROVIDERS_BY_TYPE = {
  llm: [
    { name: 'Claude Sonnet',  model: 'claude-sonnet-4-6' },
    { name: 'GPT-4o',         model: 'gpt-4o-2024-11-20' },
    { name: 'Gemini 1.5 Pro', model: 'gemini-1.5-pro' },
  ],
  stt: [
    { name: 'Whisper (OpenAI)', model: 'whisper-1' },
    { name: 'Deepgram Nova',    model: 'nova-2' },
  ],
  tts: [
    { name: 'ElevenLabs', model: 'eleven_multilingual_v2' },
    { name: 'OpenAI TTS', model: 'tts-1-hd' },
  ],
};

/** Test datasets available per type in the Benchmark config dropdowns. */
export const DATASETS_BY_TYPE = {
  llm: ['MT-Bench QA', 'ToolBench Tasks', 'MMLU Subset'],
  stt: ['LibriSpeech Clean', 'Common Voice EN', 'Noisy Call Center'],
  tts: ['VCTK Sentences', 'LJSpeech Samples', 'Custom Prompts'],
};

/** Chart fill colors — cycled by index across bar charts. */
export const CHART_COLORS = ['#378ADD', '#639922', '#BA7517', '#D4537E', '#7F77DD'];

/** Seed data for the Providers table on first load. */
export const INITIAL_PROVIDERS = [
  { id: 1, name: 'Whisper (OpenAI)', type: 'stt', model: 'whisper-1' },
  { id: 2, name: 'GPT-4o',           type: 'llm', model: 'gpt-4o-2024-11-20' },
  { id: 3, name: 'ElevenLabs',        type: 'tts', model: 'eleven_multilingual_v2' },
  { id: 4, name: 'Claude Sonnet',     type: 'llm', model: 'claude-sonnet-4-6' },
];

/** Seed benchmark runs shown before the user creates their own. */
export const INITIAL_RUNS = [
  {
    id: 1, provider: 'GPT-4o', model: 'gpt-4o-2024-11-20',
    type: 'llm', dataset: 'MT-Bench QA', iterations: 10,
    status: 'completed', progress: 100,
    p50: 312, p95: 890, accuracy: 0.91, cost: 0.042,
  },
  {
    id: 2, provider: 'Claude Sonnet', model: 'claude-sonnet-4-6',
    type: 'llm', dataset: 'MT-Bench QA', iterations: 10,
    status: 'completed', progress: 100,
    p50: 278, p95: 710, accuracy: 0.94, cost: 0.038,
  },
  {
    id: 3, provider: 'Whisper (OpenAI)', model: 'whisper-1',
    type: 'stt', dataset: 'LibriSpeech Clean', iterations: 5,
    status: 'failed', progress: 100,
    p50: null, p95: null, accuracy: null, cost: null,
  },
  {
    id: 4, provider: 'ElevenLabs', model: 'eleven_multilingual_v2',
    type: 'tts', dataset: 'VCTK Sentences', iterations: 5,
    status: 'completed', progress: 100,
    p50: 410, p95: 980, accuracy: 0.89, cost: 0.021,
  },
];
