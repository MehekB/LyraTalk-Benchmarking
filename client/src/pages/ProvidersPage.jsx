// pages/ProvidersPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Providers page. Lets users view, filter, add, edit, and delete
// the providers registered for benchmarking.
//
// State owned here: currentFilter, modalState (open/provider being edited).
// Provider CRUD is dispatched to global state via useAppDispatch.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useAppState, useAppDispatch } from '../hooks/useAppState';
import ProviderModal from '../components/ProviderModal';
import TypeBadge    from '../components/ui/TypeBadge';

const FILTER_OPTIONS = ['all', 'stt', 'llm', 'tts'];

export default function ProvidersPage() {
  const { providers }  = useAppState();
  const dispatch       = useAppDispatch();

  // 'all' | 'stt' | 'llm' | 'tts'
  const [filter, setFilter] = useState('all');

  // null = modal closed; undefined = add mode; Provider object = edit mode
  const [editingProvider, setEditingProvider] = useState(null);
  const [modalOpen,       setModalOpen]       = useState(false);

  // ── Derived ──────────────────────────────────────────────────────────────
  const visible = filter === 'all'
    ? providers
    : providers.filter(p => p.type === filter);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openAdd  = ()  => { setEditingProvider(null); setModalOpen(true); };
  const openEdit = (p) => { setEditingProvider(p);    setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  const handleSave = (data) => {
    if (data.id !== undefined) {
      dispatch({ type: 'EDIT_PROVIDER', payload: data });
    } else {
      dispatch({ type: 'ADD_PROVIDER', payload: data });
    }
    closeModal();
  };

  const handleDelete = (id) => {
    dispatch({ type: 'DELETE_PROVIDER', payload: id });
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
            {visible.length === 0 ? (
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
