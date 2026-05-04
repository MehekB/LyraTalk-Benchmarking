// Colored pill showing the provider/run type: STT | LLM | TTS
// Props: type — 'stt' | 'llm' | 'tts'

export default function TypeBadge({ type }) {
  return (
    <span className={`badge badge-${type}`}>
      {type.toUpperCase()}
    </span>
  );
}
