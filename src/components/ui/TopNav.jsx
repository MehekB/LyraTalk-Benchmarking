// Sticky top navigation bar shared across all pages.
// Props:
//   currentPage  — 'providers' | 'benchmark' | 'dashboard'
//   onNavigate   — (page: string) => void

const LINKS = [
  { id: 'providers', label: 'Providers' },
  { id: 'benchmark', label: 'Benchmark' },
  { id: 'dashboard', label: 'Dashboard' },
];

export default function TopNav({ currentPage, onNavigate }) {
  return (
    <nav style={styles.nav}>
      <span style={styles.brand}>LyraTalk</span>
      <div style={styles.links}>
        {LINKS.map(link => (
          <button
            key={link.id}
            onClick={() => onNavigate(link.id)}
            className={`nav-link${currentPage === link.id ? ' active' : ''}`}
            style={styles.navLink}
          >
            {link.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    background: 'var(--bg-secondary)',
    borderBottom: '0.5px solid var(--border-subtle)',
    padding: '0 2rem',
    display: 'flex',
    alignItems: 'center',
    gap: '2.5rem',
    height: 52,
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  brand: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text-primary)',
    letterSpacing: '-0.01em',
  },
  links: { display: 'flex', gap: 4 },
  navLink: {
    fontSize: 13,
    padding: '6px 12px',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    fontFamily: 'inherit',
    transition: 'background 0.15s, color 0.15s',
    textDecoration: 'none',
    color: 'var(--text-secondary)',
  },
};
