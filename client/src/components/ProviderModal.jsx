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

const INPUT_PRICE_LABELS = {
  llm: 'Input cost (per 1M tokens)',
  tts: 'Cost (per 1M chars)',
  stt: 'Cost (per minute)',
};

function formatPrice(value) {
  if (value == null || value === '') return '';
  return String(value);
}

function parsePriceInput(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : trimmed;
}

async function saveProviderToApi({
  isEdit,
  provider,
  name,
  type,
  model,
  inputUnitPrice,
  outputUnitPrice,
}) {
  const body = {
    name,
    type,
    model,
    input_unit_price: inputUnitPrice,
    ...(type === 'llm' ? { output_unit_price: outputUnitPrice } : {}),
  };
  const path = isEdit
    ? `/api/providers/${encodeURIComponent(provider.id)}`
    : '/api/providers';
  const res = await apiFetch(path, {
    method: isEdit ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
  const [inputUnitPrice, setInputUnitPrice] = useState(
    formatPrice(provider?.input_unit_price)
  );
  const [outputUnitPrice, setOutputUnitPrice] = useState(
    formatPrice(provider?.output_unit_price)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]  = useState('');

  const handleTypeChange = (nextType) => {
    setType(nextType);
    if (nextType !== 'llm') setOutputUnitPrice('');
  };

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
        inputUnitPrice: parsePriceInput(inputUnitPrice),
        outputUnitPrice: type === 'llm' ? parsePriceInput(outputUnitPrice) : null,
      });
      onSave({
        id: Number(row.id),
        name: row.name,
        type: row.type,
        model: row.model,
        input_unit_price: row.input_unit_price,
        output_unit_price: row.output_unit_price,
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
        <select value={type} onChange={e => handleTypeChange(e.target.value)}>
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
      <div className="field">
        <label>{INPUT_PRICE_LABELS[type]}</label>
        <input
          type="number"
          min="0"
          step="any"
          placeholder="e.g. 2.50"
          value={inputUnitPrice}
          onChange={e => setInputUnitPrice(e.target.value)}
        />
      </div>
      {type === 'llm' ? (
        <div className="field">
          <label>Output cost (per 1M tokens)</label>
          <input
            type="number"
            min="0"
            step="any"
            placeholder="e.g. 10.00"
            value={outputUnitPrice}
            onChange={e => setOutputUnitPrice(e.target.value)}
          />
        </div>
      ) : null}
      {error ? (
        <p className="modal-error" role="alert" style={{ color: '#c62828', marginTop: '0.75rem', fontSize: '0.9rem' }}>
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
