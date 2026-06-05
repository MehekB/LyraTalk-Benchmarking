// pages/BenchmarkPage.jsx
import { useState } from 'react';
import { useBenchmarkRunner } from '../hooks/useBenchmarkRunner';
import { useBenchmarkRuns } from '../hooks/useBenchmarkRuns';
import BenchmarkRunForm from '../components/BenchmarkRunForm';
import BenchmarkRunPanel from '../components/BenchmarkRunPanel';
import BenchmarkRunsTable from '../components/BenchmarkRunsTable';

export default function BenchmarkPage({ onNavigate }) {
  const { runs, loading, error, reload } = useBenchmarkRuns();
  const { startRun, sessionStatus, clearSessionStatus } = useBenchmarkRunner();
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');

  const handleSubmit = async (config) => {
    setRunning(true);
    setRunError('');
    clearSessionStatus();

    try {
      await startRun(config, {
        onRunComplete: () => reload(),
      });
      await reload();
    } catch (e) {
      setRunError(e instanceof Error ? e.message : 'Failed to start benchmark');
    } finally {
      setRunning(false);
    }
  };

  const showPanel =
    sessionStatus &&
    (sessionStatus.phase === 'starting' ||
      sessionStatus.phase === 'waiting' ||
      sessionStatus.phase === 'completed' ||
      sessionStatus.phase === 'timeout' ||
      sessionStatus.phase === 'error');

  return (
    <div style={styles.page}>
      <div className="page-header">
        <div>
          <h1>Benchmark</h1>
          <p>
            Run benchmark starts the local voice agent in a new Terminal window. Talk for a few turns,
            end the session, and metrics save to your database automatically.
          </p>
        </div>
      </div>

      {error && (
        <p style={styles.error}>
          {error} — Start the API (<code>cd server && npm run dev</code>) and ensure runs exist in the DB.
        </p>
      )}

      {runError && <p style={styles.error}>{runError}</p>}

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

      {showPanel && (
        <BenchmarkRunPanel
          status={sessionStatus}
          onDismiss={clearSessionStatus}
        />
      )}
    </div>
  );
}

const styles = {
  page: { padding: '2rem', maxWidth: 1100 },
  error: { color: '#b42318', fontSize: 13, marginBottom: '1rem' },
};
