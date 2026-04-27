
// Displays the list of benchmark runs with live progress bars,
// status badges, and action links.

// Props:
//   runs         — Run[] from global state
//   onViewResults — (run) => void  — called when "View results →" is clicked

import TypeBadge   from './ui/TypeBadge';
import StatusBadge from './ui/StatusBadge';

export default function BenchmarkRunsTable({ runs, onViewResults }) {
  if (runs.length === 0) {
    return (
      <div className="table-wrap">
        <div className="empty">No runs yet. Configure and start a benchmark above.</div>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Provider / Model</th>
            <th>Type</th>
            <th>Dataset</th>
            <th>Iter.</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(run => (
            <tr key={run.id}>
              <td className="primary">
                {run.provider}
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {run.model}
                </div>
                {run.status === 'running' && (
                  <div className="progress-wrap">
                    <div className="progress-bar" style={{ width: `${run.progress}%` }} />
                  </div>
                )}
              </td>
              <td><TypeBadge type={run.type} /></td>
              <td>{run.dataset}</td>
              <td>{run.iterations}</td>
              <td><StatusBadge status={run.status} /></td>
              <td>
                {run.status === 'completed' && (
                  <button className="action-link" onClick={() => onViewResults(run)}>
                    View results →
                  </button>
                )}
                {run.status === 'failed' && (
                  <button className="action-link danger">Retry</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
