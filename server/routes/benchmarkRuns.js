import { Router } from "express";

const PROVIDER_TYPES = [
  { key: "stt", column: "stt_provider_id", type: "STT", bodyKey: "stt_model" },
  { key: "llm", column: "llm_provider_id", type: "LLM", bodyKey: "llm_model" },
  { key: "tts", column: "tts_provider_id", type: "TTS", bodyKey: "tts_model" },
];

async function lookupProviderId(client, model, type) {
  const md = String(model ?? "").trim();
  if (!md) return null;
  const { rows } = await client.query(
    `SELECT id FROM providers WHERE model = $1 AND type = $2`,
    [md, type]
  );
  return rows[0]?.id ?? null;
}

function optionalNonNegativeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return { error: true };
  return n;
}

function optionalNonNegativeInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return { error: true };
  return n;
}

function normalizeTurn(raw, index) {
  const turnNumber = Number(raw?.turn_number ?? raw?.turn ?? index + 1);
  const stt = Number(raw?.stt_latency_ms);
  const llm = Number(raw?.llm_latency_ms);
  const tts = Number(raw?.tts_latency_ms);
  const e2e = Number(raw?.e2e_latency_ms);
  if (
    !Number.isInteger(turnNumber) ||
    turnNumber < 1 ||
    turnNumber > 3 ||
    !Number.isFinite(stt) ||
    !Number.isFinite(llm) ||
    !Number.isFinite(tts) ||
    !Number.isFinite(e2e)
  ) {
    return null;
  }

  const sttAudioDurationS = optionalNonNegativeNumber(raw?.stt_audio_duration_s);
  if (sttAudioDurationS && typeof sttAudioDurationS === "object") return null;

  const llmPromptTokens = optionalNonNegativeInt(raw?.llm_prompt_tokens);
  if (llmPromptTokens && typeof llmPromptTokens === "object") return null;

  const llmCompletionTokens = optionalNonNegativeInt(raw?.llm_completion_tokens);
  if (llmCompletionTokens && typeof llmCompletionTokens === "object") return null;

  const ttsCharCount = optionalNonNegativeInt(raw?.tts_char_count);
  if (ttsCharCount && typeof ttsCharCount === "object") return null;

  return {
    turn_number: turnNumber,
    stt_latency_ms: stt,
    llm_latency_ms: llm,
    tts_latency_ms: tts,
    e2e_latency_ms: e2e,
    stt_audio_duration_s: sttAudioDurationS,
    llm_prompt_tokens: llmPromptTokens,
    llm_completion_tokens: llmCompletionTokens,
    tts_char_count: ttsCharCount,
  };
}

/** Routes for `benchmark_runs` + `benchmark_turns` (see server/db/*.sql). */
export default function benchmarkRunsRouter(pool) {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT
           br.id,
           br.recorded_at,
           ps.name AS stt_provider_name,
           ps.model AS stt_model,
           pl.name AS llm_provider_name,
           pl.model AS llm_model,
           pt.name AS tts_provider_name,
           pt.model AS tts_model,
           COALESCE(
             json_agg(
               json_build_object(
                 'turn_number', bt.turn_number,
                 'stt_latency_ms', bt.stt_latency_ms,
                 'llm_latency_ms', bt.llm_latency_ms,
                 'tts_latency_ms', bt.tts_latency_ms,
                 'e2e_latency_ms', bt.e2e_latency_ms,
                 'stt_audio_duration_s', bt.stt_audio_duration_s,
                 'llm_prompt_tokens', bt.llm_prompt_tokens,
                 'llm_completion_tokens', bt.llm_completion_tokens,
                 'tts_char_count', bt.tts_char_count
               )
               ORDER BY bt.turn_number
             ) FILTER (WHERE bt.turn_number IS NOT NULL),
             '[]'::json
           ) AS turns
         FROM benchmark_runs br
         JOIN providers ps ON ps.id = br.stt_provider_id
         JOIN providers pl ON pl.id = br.llm_provider_id
         JOIN providers pt ON pt.id = br.tts_provider_id
         LEFT JOIN benchmark_turns bt ON bt.run_id = br.id
         GROUP BY
           br.id, br.recorded_at,
           ps.name, ps.model, pl.name, pl.model, pt.name, pt.model
         ORDER BY br.recorded_at ASC`
      );
      return res.json(
        rows.map((r) => ({
          id: Number(r.id),
          recorded_at: r.recorded_at,
          stt_provider_name: r.stt_provider_name,
          stt_model: r.stt_model,
          llm_provider_name: r.llm_provider_name,
          llm_model: r.llm_model,
          tts_provider_name: r.tts_provider_name,
          tts_model: r.tts_model,
          turns: Array.isArray(r.turns) ? r.turns : [],
        }))
      );
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to list benchmark runs" });
    }
  });

  router.post("/", async (req, res) => {
    const body = req.body ?? {};
    const { recorded_at, turns: rawTurns } = body;
    const models = {
      stt: String(body.stt_model ?? "").trim(),
      llm: String(body.llm_model ?? "").trim(),
      tts: String(body.tts_model ?? "").trim(),
    };

    if (!models.stt || !models.llm || !models.tts) {
      return res.status(400).json({
        error: "stt_model, llm_model, and tts_model are required",
      });
    }

    if (!Array.isArray(rawTurns) || rawTurns.length === 0) {
      return res.status(400).json({ error: "turns must be a non-empty array" });
    }

    const turns = [];
    for (let i = 0; i < rawTurns.length; i += 1) {
      const t = normalizeTurn(rawTurns[i], i);
      if (!t) {
        return res.status(400).json({
          error:
            "Each turn needs turn_number (1–3), finite stt/llm/tts/e2e latency values (ms), and optional non-negative usage metrics",
          index: i,
        });
      }
      turns.push(t);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const providerIds = {};
      for (const spec of PROVIDER_TYPES) {
        const id = await lookupProviderId(client, models[spec.key], spec.type);
        if (!id) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error: `No ${spec.type} provider registered for model`,
            model: models[spec.key],
            type: spec.key,
          });
        }
        providerIds[spec.key] = id;
      }

      const recordedAt =
        recorded_at != null && String(recorded_at).trim() !== ""
          ? String(recorded_at).trim()
          : null;

      const { rows: runRows } = await client.query(
        `INSERT INTO benchmark_runs (
           stt_provider_id, llm_provider_id, tts_provider_id, recorded_at
         )
         VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()))
         RETURNING id, recorded_at`,
        [
          providerIds.stt,
          providerIds.llm,
          providerIds.tts,
          recordedAt,
        ]
      );
      const runId = Number(runRows[0].id);

      for (const t of turns) {
        await client.query(
          `INSERT INTO benchmark_turns (
             run_id, turn_number,
             stt_latency_ms, llm_latency_ms, tts_latency_ms, e2e_latency_ms,
             stt_audio_duration_s, llm_prompt_tokens, llm_completion_tokens, tts_char_count
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            runId,
            t.turn_number,
            t.stt_latency_ms,
            t.llm_latency_ms,
            t.tts_latency_ms,
            t.e2e_latency_ms,
            t.stt_audio_duration_s,
            t.llm_prompt_tokens,
            t.llm_completion_tokens,
            t.tts_char_count,
          ]
        );
      }

      await client.query("COMMIT");

      return res.status(201).json({
        id: runId,
        recorded_at: runRows[0].recorded_at,
        stt_provider_id: providerIds.stt,
        llm_provider_id: providerIds.llm,
        tts_provider_id: providerIds.tts,
        turn_count: turns.length,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      return res.status(500).json({ error: "Failed to create benchmark run" });
    } finally {
      client.release();
    }
  });

  return router;
}
