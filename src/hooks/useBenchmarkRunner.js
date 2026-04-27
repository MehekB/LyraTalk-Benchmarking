// hooks/useBenchmarkRunner.js
// ─────────────────────────────────────────────────────────────────────────────
// Encapsulates the logic for starting a benchmark run and simulating
// progress updates. In a real app, `startRun` would POST to your API and
// then poll GET /api/runs/:id every few seconds via React Query until
// status === 'completed' | 'failed'.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback } from 'react';
import { useAppState, useAppDispatch } from './useAppState';

export function useBenchmarkRunner() {
  const { nextRunId } = useAppState();
  const dispatch = useAppDispatch();

  const startRun = useCallback(({ provider, model, type, dataset, iterations }) => {
    const id = nextRunId;

    // 1. Add run in "running" state
    dispatch({
      type: 'ADD_RUN',
      payload: { provider, model, type, dataset, iterations, status: 'running', progress: 0,
                 p50: null, p95: null, accuracy: null, cost: null },
    });

    // 2. Simulate progress ticks (replace with real polling in production)
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 18 + 5;
      const progress = Math.min(Math.round(p), 100);
      const done = progress >= 100;

      dispatch({
        type: 'UPDATE_RUN',
        payload: {
          id,
          progress,
          ...(done && {
            status:   'completed',
            p50:      Math.round(200 + Math.random() * 400),
            p95:      Math.round(200 + Math.random() * 400 * 2),
            accuracy: parseFloat((0.78 + Math.random() * 0.20).toFixed(2)),
            cost:     parseFloat((0.01 + Math.random() * 0.06).toFixed(3)),
          }),
        },
      });

      if (done) clearInterval(iv);
    }, 350);
  }, [nextRunId, dispatch]);

  return { startRun };
}
