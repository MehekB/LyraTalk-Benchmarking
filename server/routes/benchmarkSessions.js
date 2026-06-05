import { Router } from "express";
import { getAgentConsoleStatus, spawnAgentConsole } from "../lib/spawnAgentConsole.mjs";

export default function benchmarkSessionsRouter() {
  const router = Router();

  router.get("/status", (_req, res) => {
    const status = getAgentConsoleStatus();
    return res.json(status);
  });

  router.post("/start", (req, res) => {
    const pipeline = {
      stt_model: process.env.BENCHMARK_STT_MODEL?.trim() || "deepgram/nova-3",
      llm_model: process.env.BENCHMARK_LLM_MODEL?.trim() || "xai/grok-4-1-fast-non-reasoning",
      tts_model: process.env.BENCHMARK_TTS_MODEL?.trim() || "cartesia/sonic-3",
    };

    const body = req.body ?? {};
    const requested = {
      type: body.type ?? null,
      provider: body.provider ?? null,
      model: body.model ?? null,
      dataset: body.dataset ?? null,
      iterations: body.iterations ?? null,
    };

    try {
      const launch = spawnAgentConsole();

      return res.json({
        ...launch,
        pipeline,
        requested,
        command: "uv run python src/agent.py console",
        instructions: launch.alreadyRunning
          ? [
              "Agent console is already running in a terminal window.",
              "Talk to the agent there (~3 turns), then end the session (Ctrl+C or quit).",
              "Results appear here when the session closes.",
            ]
          : launch.launchMethod === "terminal"
            ? [
                "A new Terminal window should open with the voice agent.",
                "Allow microphone access if prompted.",
                "Talk for a few turns, then end the session (Ctrl+C or quit).",
                "Metrics save to the database when the session ends.",
              ]
            : [
                "Agent started in the background.",
                "For microphone access, run manually: cd agent && uv run python src/agent.py console",
                "End the session when done — metrics save automatically.",
              ],
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        error: "Failed to start agent console process",
        hint: "Ensure uv is installed and agent/ has run uv sync",
      });
    }
  });

  return router;
}
