
// Horizontal bar chart used on the Dashboard.
export default function BarChart({ data, colors }) {
  if (!data || data.length === 0) {
    return <div className="empty">No completed runs yet.</div>;
  }

  const max = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="bar-chart">
      {data.map((row, i) => {
        const pct = Math.round((row.value / max) * 100);
        const color = colors[i % colors.length];
        return (
          <div key={row.label} className="bar-row">
            <div className="bar-label" title={row.label}>{row.label}</div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${pct}%`, background: color }}
              >
                {pct > 25 ? row.display : ''}
              </div>
            </div>
            <div className="bar-val">{row.display}</div>
          </div>
        );
      })}
    </div>
  );
}
