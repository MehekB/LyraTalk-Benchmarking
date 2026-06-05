CREATE TABLE IF NOT EXISTS providers (
  id    BIGSERIAL PRIMARY KEY,
  name  TEXT        NOT NULL,
  model TEXT        NOT NULL,
  type  TEXT        NOT NULL CHECK (type IN ('STT', 'LLM', 'TTS')),
  input_unit_price  NUMERIC(12, 6),
  output_unit_price NUMERIC(12, 6)
);