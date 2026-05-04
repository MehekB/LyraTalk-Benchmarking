// components/ProviderModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Add or edit a provider. Shares the same Modal + form for both actions.
// Controlled by the parent (ProvidersPage) via the `provider` prop:
//   provider = null   → "Add" mode
//   provider = {...}  → "Edit" mode, fields pre-filled
//
// Props:
//   provider  — Provider object | null
//   onSave    — ({ name, type, model, id? }) => void
//   onClose   — () => void

import { useState } from 'react';
import Modal from './ui/Modal';

export default function ProviderModal({ provider, onSave, onClose }) {
  const isEdit = Boolean(provider);

  // Form state — pre-fill when editing
  const [name,  setName]  = useState(provider?.name  ?? '');
  const [type,  setType]  = useState(provider?.type  ?? 'llm');
  const [model, setModel] = useState(provider?.model ?? '');

  const handleSave = () => {
    if (!name.trim() || !model.trim()) return; // basic validation
    onSave({ id: provider?.id, name: name.trim(), type, model: model.trim() });
  };

  const footer = (
    <>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn btn-solid" onClick={handleSave}>Save</button>
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
    </Modal>
  );
}
