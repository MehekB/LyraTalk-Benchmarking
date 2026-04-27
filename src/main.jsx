// main.jsx
// ─────────────────────────────────────────────────────────────────────────────
// React entry point. Mounts <App /> into the #root div in index.html.
// In Next.js this file doesn't exist — the framework handles mounting.
// ─────────────────────────────────────────────────────────────────────────────
import { StrictMode } from 'react';
import { createRoot }  from 'react-dom/client';
import App             from './App';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
