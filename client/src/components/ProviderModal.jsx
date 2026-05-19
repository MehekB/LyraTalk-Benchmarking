// components/ProviderModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Add or edit a provider. Shares the same Modal + form for both actions.
// Controlled by the parent (ProvidersPage) via the `provider` prop:
//   provider = null   → "Add" mode
//   provider = {...}  → "Edit" mode, fields pre-filled
//
// Props:
//   provider  — Provider object | null
//   onSave    — ({ name, type, model, id }) => void  (after successful POST/PUT to API)
//   onClose   — () => void

import { useState } from 'react';
import Modal from './ui/Modal';
import { apiFetch } from '../lib/api';

async function saveProviderToApi({ isEdit, provider, name, type, model }) {
  const body = JSON.stringify({ name, type, model });
  const path = isEdit
    ? `/api/providers/${encodeURIComponent(provider.id)}`
    : '/api/providers';
  const res = await apiFetch(path, {
    method: isEdit ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || res.statusText || 'Request failed';
    throw new Error(msg);
  }
  return data;
}

export default function ProviderModal({ provider, onSave, onClose }) {
  const isEdit = Boolean(provider);

  // Form state — pre-fill when editing
  const [name,  setName]  = useState(provider?.name  ?? '');
  const [type,  setType]  = useState(provider?.type  ?? 'llm');
  const [model, setModel] = useState(provider?.model ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError]  = useState('');

  const handleSave = async () => {
    if (!name.trim() || !model.trim()) return;
    setError('');
    setSaving(true);
    try {
      const row = await saveProviderToApi({
        isEdit,
        provider,
        name: name.trim(),
        type,
        model: model.trim(),
      });
      onSave({
        id: Number(row.id),
        name: row.name,
        type: row.type,
        model: row.model,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
      <button className="btn btn-solid" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </>
  );

  return (
    <Modal
      title={isEdit ? 'Edit provider' : 'Add provider'}
      onClose={onClose}
      footer={footer}
    >
      <div className="field">
        <label>Provider name</label>
        <input
          type="text"
          placeholder="e.g. OpenAI"
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Type</label>
        <select value={type} onChange={e => setType(e.target.value)}>
          <option value="llm">LLM</option>
          <option value="stt">STT</option>
          <option value="tts">TTS</option>
        </select>
      </div>
      <div className="field">
        <label>Model identifier</label>
        <input
          type="text"
          placeholder="e.g. gpt-4o"
          value={model}
          onChange={e => setModel(e.target.value)}
        />
      </div>
      {error ? (
        <p className="modal-error" role="alert" style={{ color: '#c62828', marginTop: '0.75rem', fontSize: '0.9rem' }}>
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
