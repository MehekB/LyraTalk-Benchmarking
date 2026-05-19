import { useCallback, useEffect, useState } from "react";
import { fetchBenchmarkRuns } from "../lib/benchmarkRuns";
import { useAppDispatch, useAppState } from "./useAppState";

export function useBenchmarkRuns() {
  const { runs } = useAppState();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    try {
      const list = await fetchBenchmarkRuns();
      dispatch({ type: "SET_RUNS", payload: list });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load benchmark runs";
      setError(msg);
      dispatch({ type: "SET_RUNS", payload: [] });
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { runs, loading, error, reload };
}
