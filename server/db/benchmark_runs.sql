CREATE TABLE IF NOT EXISTS benchmark_runs (
  id               BIGSERIAL PRIMARY KEY,
  stt_provider_id  BIGINT      NOT NULL REFERENCES providers (id) ON DELETE RESTRICT,
  llm_provider_id  BIGINT      NOT NULL REFERENCES providers (id) ON DELETE RESTRICT,
  tts_provider_id  BIGINT      NOT NULL REFERENCES providers (id) ON DELETE RESTRICT,
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_benchmark_runs_recorded_at
  ON benchmark_runs (recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_benchmark_runs_stt_provider
  ON benchmark_runs (stt_provider_id);

CREATE INDEX IF NOT EXISTS idx_benchmark_runs_llm_provider
  ON benchmark_runs (llm_provider_id);

CREATE INDEX IF NOT EXISTS idx_benchmark_runs_tts_provider
  ON benchmark_runs (tts_provider_id);