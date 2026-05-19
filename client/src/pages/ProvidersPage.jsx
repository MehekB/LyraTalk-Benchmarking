// pages/ProvidersPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Providers page. Lets users view, filter, add, edit, and delete
// the providers registered for benchmarking.
//
// State owned here: currentFilter, modalState (open/provider being edited).
// Provider list is loaded from GET /api/providers; writes use POST/PUT/DELETE then refetch.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { useAppState, useAppDispatch } from '../hooks/useAppState';
import ProviderModal from '../components/ProviderModal';
import TypeBadge    from '../components/ui/TypeBadge';
import { apiFetch } from '../lib/api';

const FILTER_OPTIONS = ['all', 'stt', 'llm', 'tts'];

async function fetchProvidersList() {
  const res = await apiFetch('/api/providers');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || res.statusText || 'Failed to load providers');
  }
  return Array.isArray(data) ? data : [];
}

export default function ProvidersPage() {
  const { providers }  = useAppState();
  const dispatch       = useAppDispatch();

  // 'all' | 'stt' | 'llm' | 'tts'
  const [filter, setFilter] = useState('all');

  // null = modal closed; undefined = add mode; Provider object = edit mode
  const [editingProvider, setEditingProvider] = useState(null);
  const [modalOpen,       setModalOpen]       = useState(false);
  const [loading,         setLoading]         = useState(true);
  const [loadError,       setLoadError]       = useState('');

  const reloadProviders = useCallback(async () => {
    setLoadError('');
    try {
      const list = await fetchProvidersList();
      dispatch({ type: 'SET_PROVIDERS', payload: list });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load providers');
      dispatch({ type: 'SET_PROVIDERS', payload: [] });
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    reloadProviders();
  }, [reloadProviders]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const visible = filter === 'all'
    ? providers
    : providers.filter(p => p.type === filter);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openAdd  = ()  => { setEditingProvider(null); setModalOpen(true); };
  const openEdit = (p) => { setEditingProvider(p);    setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  const handleSave = async () => {
    await reloadProviders();
    closeModal();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this provider from the database?')) return;
    try {
      const res = await apiFetch(`/api/providers/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || res.statusText);
      }
      await reloadProviders();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div style={styles.page}>

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1>Providers</h1>
          <p>View and manage all STT, LLM, and TTS providers available for benchmarking.</p>
        </div>
        <button className="btn btn-outline" onClick={openAdd}>+ Add Provider</button>
      </div>

      {/* ── Filter tabs ── */}
      <div className="filter-row">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt}
            className={`filter-btn${filter === opt ? ' active' : ''}`}
            onClick={() => setFilter(opt)}
          >
            {opt === 'all' ? 'All' : opt.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="table-wrap">
        {loadError ? (
          <p className="empty" role="alert" style={{ padding: '1rem', color: '#c62828' }}>
            {loadError} — Start the API (<code>cd server && npm run dev</code>), restart Vite after editing <code>vite.config.js</code>, or set <code>VITE_API_ORIGIN=http://127.0.0.1:3001</code> in <code>client/.env</code>.
          </p>
        ) : null}
        <table>
          <thead>
            <tr>
              <th style={{ width: '30%' }}>Name</th>
              <th style={{ width: '18%' }}>Type</th>
              <th style={{ width: '35%' }}>Model</th>
              <th style={{ width: '17%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="empty">Loading providers…</td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty">No providers found.</td>
              </tr>
            ) : (
              visible.map(provider => (
                <tr key={provider.id}>
                  <td className="primary">{provider.name}</td>
                  <td><TypeBadge type={provider.type} /></td>
                  <td>{provider.model}</td>
                  <td style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button
                      className="action-link"
                      onClick={() => openEdit(provider)}
                    >
                      Edit
                    </button>
                    <button
                      className="action-link danger"
                      onClick={() => handleDelete(provider.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="table-footer">
        * Each row shows: provider name, type (STT / LLM / TTS), model identifier. Actions: Edit, Delete.
      </p>

      {/* ── Modal ── */}
      {modalOpen && (
        <ProviderModal
          provider={editingProvider}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

const styles = {
  page: { padding: '2rem', maxWidth: 1100 },
};
