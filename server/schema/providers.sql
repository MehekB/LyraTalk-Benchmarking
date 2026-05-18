-- Providers available for voice pipeline benchmarks (STT / LLM / TTS).

CREATE TABLE IF NOT EXISTS providers (
  id    BIGSERIAL PRIMARY KEY,
  name  TEXT        NOT NULL,
  model TEXT        NOT NULL,
  type  TEXT        NOT NULL CHECK (type IN ('STT', 'LLM', 'TTS'))
);

CREATE INDEX IF NOT EXISTS idx_providers_type ON providers (type);
