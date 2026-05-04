
// Shows run status with a colored pill + animated dot.
// Props: status — 'pending' | 'running' | 'completed' | 'failed'
export default function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span className={`dot dot-${status}`} />
      {status}
    </span>
  );
}
