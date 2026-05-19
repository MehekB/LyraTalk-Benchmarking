// components/ui/TopNav.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Sticky top nav — purple theme matching the wireframe.
// Active page uses a filled white pill; others are muted text.
// ─────────────────────────────────────────────────────────────────────────────

const LINKS = [
  { id: 'providers', label: 'Providers' },
  { id: 'benchmark', label: 'Benchmark' },
  { id: 'dashboard', label: 'Dashboard' },
];

export default function TopNav({ currentPage, onNavigate }) {
  return (
    <nav style={S.nav}>
      {/* Brand */}
      <div style={S.brand}>
        <span style={S.micIcon}>🎙</span>
        <span style={S.brandText}>LyraTalk</span>
      </div>

      {/* Nav links */}
      <div style={S.links}>
        {LINKS.map(link => {
          const active = currentPage === link.id;
          return (
            <button
              key={link.id}
              onClick={() => onNavigate(link.id)}
              style={{ ...S.link, ...(active ? S.linkActive : S.linkInactive) }}
            >
              {link.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

const S = {
  nav: {
    background: '#3D2E8C',
    padding: '0 2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  brand: { display: 'flex', alignItems: 'center', gap: 10 },
  micIcon: {
    fontSize: 16,
    background: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: '4px 7px',
    display: 'flex',
    alignItems: 'center',
  },
  brandText: { fontSize: 15, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' },
  links:    { display: 'flex', gap: 4 },
  link: {
    fontSize: 13,
    padding: '6px 14px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  linkActive: {
    background: '#fff',
    color: '#3D2E8C',
  },
  linkInactive: {
    background: 'transparent',
    color: 'rgba(255,255,255,0.75)',
  },
};