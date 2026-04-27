
// The left-hand configuration card on the Benchmark page.
// Lets the user select type, provider, dataset, and iteration count,
// then fires onSubmit with the selected values.

// Props:
//   onSubmit — ({ provider, model, type, dataset, iterations }) => void
//   running  — boolean — disables the button while a run is in progress

import { useState } from 'react';
import { PROVIDERS_BY_TYPE, DATASETS_BY_TYPE } from '../data/constants';

export default function BenchmarkRunForm({ onSubmit, running }) {
  const [type,       setType]       = useState('llm');
  const [providerIdx, setProviderIdx] = useState(0);
  const [datasetIdx,  setDatasetIdx]  = useState(0);
  const [iterations, setIterations] = useState(5);

  // When type changes, reset provider and dataset selections to index 0
  const handleTypeChange = (e) => {
    setType(e.target.value);
    setProviderIdx(0);
    setDatasetIdx(0);
  };

  const providers = PROVIDERS_BY_TYPE[type];
  const datasets  = DATASETS_BY_TYPE[type];

  const handleSubmit = () => {
    onSubmit({
      type,
      provider:   providers[providerIdx].name,
      model:      providers[providerIdx].model,
      dataset:    datasets[datasetIdx],
      iterations: parseInt(iterations) || 5,
    });
  };

  return (
    <div className="card">
      <div className="card-title">New benchmark run</div>

      <div className="field">
        <label>Provider type</label>
        <select value={type} onChange={handleTypeChange}>
          <option value="llm">LLM</option>
          <option value="stt">STT</option>
          <option value="tts">TTS</option>
        </select>
      </div>

      <div className="field">
        <label>Provider</label>
        <select
          value={providerIdx}
          onChange={e => setProviderIdx(Number(e.target.value))}
        >
          {providers.map((p, i) => (
            <option key={p.model} value={i}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Dataset</label>
        <select
          value={datasetIdx}
          onChange={e => setDatasetIdx(Number(e.target.value))}
        >
          {datasets.map((d, i) => (
            <option key={d} value={i}>{d}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Iterations</label>
        <input
          type="number"
          min={1}
          max={50}
          value={iterations}
          onChange={e => setIterations(e.target.value)}
        />
      </div>

      <button
        className="btn btn-solid"
        style={{ width: '100%', marginTop: '0.5rem' }}
        onClick={handleSubmit}
        disabled={running}
      >
        {running ? 'Running…' : 'Run benchmark'}
      </button>
    </div>
  );
}
