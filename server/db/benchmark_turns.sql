CREATE TABLE IF NOT EXISTS benchmark_turns (
  run_id          BIGINT           NOT NULL REFERENCES benchmark_runs (id) ON DELETE CASCADE,
  turn_number     SMALLINT         NOT NULL CHECK (turn_number BETWEEN 1 AND 3),
  stt_latency_ms  DOUBLE PRECISION NOT NULL,
  llm_latency_ms  DOUBLE PRECISION NOT NULL,
  tts_latency_ms  DOUBLE PRECISION NOT NULL,
  e2e_latency_ms  DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (run_id, turn_number)
);

CREATE INDEX IF NOT EXISTS idx_benchmark_turns_run_id
  ON benchmark_turns (run_id);
