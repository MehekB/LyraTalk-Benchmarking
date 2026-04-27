// pages/DashboardPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Dashboard page. Reads completed benchmark runs from global state
// and derives KPI metrics, bar chart data, and a results table.
//
// In a real app, this data would come from benchmark_results in your DB,
// fetched via React Query and possibly aggregated server-side in SQL.
// ─────────────────────────────────────────────────────────────────────────────
import { useAppState } from '../hooks/useAppState';
import BarChart        from '../components/ui/BarChart';
import TypeBadge       from '../components/ui/TypeBadge';
import StatusBadge     from '../components/ui/StatusBadge';
import { CHART_COLORS } from '../data/constants';

export default function DashboardPage() {
  const { runs } = useAppState();

  const completed    = runs.filter(r => r.status === 'completed');
  const withLatency  = completed.filter(r => r.p50 !== null);
  const withCost     = completed.filter(r => r.cost !== null);

  // ── KPI derivations ─────────────────────────────────────────────────────
  const avgP50 = withLatency.length
    ? Math.round(withLatency.reduce((s, r) => s + r.p50, 0) / withLatency.length)
    : null;

  const avgCost = withCost.length
    ? (withCost.reduce((s, r) => s + r.cost, 0) / withCost.length).toFixed(3)
    : null;

  // ── Chart data ───────────────────────────────────────────────────────────
  const latencyData = withLatency.map(r => ({
    label:   r.provider,
    value:   r.p50,
    display: `${r.p50} ms`,
  }));

  const costData = withCost.map(r => ({
    label:   r.provider,
    value:   r.cost,
    display: `$${r.cost}`,
  }));

  return (
    <div style={styles.page}>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Compare benchmark results across providers — latency, accuracy, and cost at a glance.</p>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="metrics-grid">
        <MetricCard label="Total runs"       value={runs.length}          sub="all time" />
        <MetricCard label="Completed"        value={completed.length}     sub="successful" />
        <MetricCard label="Avg latency (p50)" value={avgP50 ? `${avgP50} ms` : '—'} sub="across completed runs" />
        <MetricCard label="Avg cost"         value={avgCost ? `$${avgCost}` : '—'} sub="per run (USD)" />
      </div>

      {/* ── Bar Charts ── */}
      <div className="dash-grid">
        <div className="card">
          <div className="card-title">Latency by provider (p50 ms)</div>
          <BarChart data={latencyData} colors={CHART_COLORS} />
        </div>
        <div className="card">
          <div className="card-title">Cost per run (USD)</div>
          <BarChart data={costData} colors={CHART_COLORS} />
        </div>
      </div>

      {/* ── Results Table ── */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Type</th>
              <th>Dataset</th>
              <th>p50 ms</th>
              <th>p95 ms</th>
              <th>Accuracy</th>
              <th>Cost (USD)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {completed.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty">No completed benchmark runs.</td>
              </tr>
            ) : (
              completed.map(r => (
                <tr key={r.id}>
                  <td className="primary">{r.provider}</td>
                  <td><TypeBadge type={r.type} /></td>
                  <td>{r.dataset}</td>
                  <td>{r.p50 !== null ? `${r.p50} ms` : '—'}</td>
                  <td>{r.p95 !== null ? `${r.p95} ms` : '—'}</td>
                  <td>{r.accuracy !== null ? `${(r.accuracy * 100).toFixed(0)}%` : '—'}</td>
                  <td>{r.cost !== null ? `$${r.cost}` : '—'}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Small local MetricCard — only used on this page ──────────────────────────
function MetricCard({ label, value, sub }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

const styles = {
  page: { padding: '2rem', maxWidth: 1100 },
};
