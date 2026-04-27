// pages/BenchmarkPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Benchmark page. Left panel: run configuration form.
// Right panel: table of all past and current runs.
//
// Delegates:
//   - Form UI           → BenchmarkRunForm
//   - Runs table        → BenchmarkRunsTable
//   - Run simulation    → useBenchmarkRunner hook
//   - State             → global via useAppState
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useAppState }          from '../hooks/useAppState';
import { useBenchmarkRunner }   from '../hooks/useBenchmarkRunner';
import BenchmarkRunForm         from '../components/BenchmarkRunForm';
import BenchmarkRunsTable       from '../components/BenchmarkRunsTable';

export default function BenchmarkPage({ onNavigate }) {
  const { runs }   = useAppState();
  const { startRun } = useBenchmarkRunner();

  // Track whether any run is actively in progress (disables the Run button)
  const [running, setRunning] = useState(false);

  const handleSubmit = (config) => {
    setRunning(true);

    // Start the run — the hook drives progress via setInterval.
    // We poll runs[] to detect completion and re-enable the button.
    startRun(config);

    // Poll until the newest run finishes
    // In production: React Query would handle this via refetchInterval
    const poll = setInterval(() => {
      setRunning(prev => {
        // Check by reading from the store isn't possible here since this
        // closure captures stale state — the hook's dispatch drives UI.
        // Simple approach: wait 8 seconds (covers ~350ms × 24 ticks max)
        return prev;
      });
    }, 100);

    setTimeout(() => {
      setRunning(false);
      clearInterval(poll);
    }, 8500);
  };

  return (
    <div style={styles.page}>
      <div className="page-header">
        <div>
          <h1>Benchmark</h1>
          <p>Configure and run benchmarks to compare providers across latency, accuracy, and cost.</p>
        </div>
      </div>

      <div className="bench-layout">
        {/* Left: config form */}
        <BenchmarkRunForm onSubmit={handleSubmit} running={running} />

        {/* Right: runs table */}
        <div>
          <h2 style={{ marginBottom: '1rem' }}>Benchmark runs</h2>
          <BenchmarkRunsTable
            runs={runs}
            onViewResults={() => onNavigate('dashboard')}
          />
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { padding: '2rem', maxWidth: 1100 },
};
