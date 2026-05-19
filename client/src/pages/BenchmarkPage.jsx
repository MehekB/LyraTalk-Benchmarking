// pages/BenchmarkPage.jsx
import { useState } from 'react';
import { useBenchmarkRunner } from '../hooks/useBenchmarkRunner';
import { useBenchmarkRuns } from '../hooks/useBenchmarkRuns';
import BenchmarkRunForm from '../components/BenchmarkRunForm';
import BenchmarkRunsTable from '../components/BenchmarkRunsTable';

export default function BenchmarkPage({ onNavigate }) {
  const { runs, loading, error, reload } = useBenchmarkRuns();
  const { startRun } = useBenchmarkRunner();
  const [running, setRunning] = useState(false);

  const handleSubmit = (config) => {
    setRunning(true);
    startRun(config);
    setTimeout(() => {
      reload().finally(() => setRunning(false));
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

      {error && (
        <p style={styles.error}>
          {error} — Start the API (<code>cd server && npm run dev</code>) and ensure runs exist in the DB.
        </p>
      )}

      <div className="bench-layout">
        <BenchmarkRunForm onSubmit={handleSubmit} running={running} />

        <div>
          <h2 style={{ marginBottom: '1rem' }}>Benchmark runs</h2>
          {loading ? (
            <div className="empty">Loading runs…</div>
          ) : (
            <BenchmarkRunsTable
              runs={runs.filter((r) => r.turns?.length)}
              onViewResults={(run) => onNavigate({ page: 'dashboard', runId: run.id })}
            />
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { padding: '2rem', maxWidth: 1100 },
  error: { color: '#b42318', fontSize: 13, marginBottom: '1rem' },
};
