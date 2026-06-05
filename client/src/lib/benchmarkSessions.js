import { apiFetch } from "./api";
import { fetchBenchmarkRuns } from "./benchmarkRuns";

export async function startBenchmarkSession(config) {
  const res = await apiFetch("/api/benchmark-sessions/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.hint || res.statusText || "Failed to start benchmark session");
  }
  return data;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll GET /api/benchmark-runs until a run with id > sinceId and at least one turn appears.
 */
export async function pollForNewBenchmarkRun(sinceId, { intervalMs = 3000, timeoutMs = 15 * 60 * 1000 } = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const runs = await fetchBenchmarkRuns();
    const match = runs
      .filter((r) => r.id > sinceId && (r.turns?.length ?? 0) > 0)
      .sort((a, b) => b.id - a.id)[0];
    if (match) return match;
    await sleep(intervalMs);
  }

  return null;
}
