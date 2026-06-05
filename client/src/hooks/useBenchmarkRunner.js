// hooks/useBenchmarkRunner.js
import { useCallback, useState } from "react";
import { fetchBenchmarkRuns } from "../lib/benchmarkRuns";
import { pollForNewBenchmarkRun, startBenchmarkSession } from "../lib/benchmarkSessions";

export function useBenchmarkRunner() {
  const [sessionStatus, setSessionStatus] = useState(null);

  const startRun = useCallback(async (config, { onRunComplete } = {}) => {
    setSessionStatus({ phase: "starting", message: "Starting local voice agent…" });

    try {
      const runsBefore = await fetchBenchmarkRuns();
      const sinceId = runsBefore.reduce((max, r) => Math.max(max, r.id), 0);

      const session = await startBenchmarkSession(config);

      setSessionStatus({
        phase: "waiting",
        message: session.alreadyRunning
          ? "Agent console already running — switch to the Terminal window and talk to the agent."
          : session.launchMethod === "terminal"
            ? "Terminal opened — talk to the agent in the new window, then end the session."
            : "Agent process started — use the terminal to talk to the agent, then end the session.",
        pipeline: session.pipeline,
        instructions: session.instructions,
        pid: session.pid,
        launchMethod: session.launchMethod,
        command: session.command,
      });

      const newRun = await pollForNewBenchmarkRun(sinceId);

      if (newRun) {
        setSessionStatus({
          phase: "completed",
          message: `Benchmark saved (${newRun.turns.length} turn${newRun.turns.length === 1 ? "" : "s"}).`,
          run: newRun,
        });
        onRunComplete?.(newRun);
        return newRun;
      }

      setSessionStatus({
        phase: "timeout",
        message:
          "No new benchmark run yet. End the voice session in Terminal (Ctrl+C), and ensure the API server is running.",
      });
      return null;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to start benchmark";
      setSessionStatus({ phase: "error", message });
      throw e;
    }
  }, []);

  const clearSessionStatus = useCallback(() => setSessionStatus(null), []);

  return { startRun, sessionStatus, clearSessionStatus };
}
