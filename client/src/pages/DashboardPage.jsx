// pages/DashboardPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Dashboard — matches the purple wireframe design.
//
// Layout:
//   • Tabs: Results | A/B Comparison
//   • Latest Run banner (STT / LLM / TTS provider pills + Export button)
//   • 6 KPI cards: E2E latency, STT latency, LLM latency,
//                  TTS latency, Cost per run, Tool call accuracy
//   • 2 charts side-by-side: E2E bar chart (per turn) | Latency over time (line)
//   • Full results table at the bottom
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useBenchmarkRuns } from '../hooks/useBenchmarkRuns';

// ── Helpers ──────────────────────────────────────────────────────────────────
const ms2s = ms => (ms == null ? '—' : (ms / 1000).toFixed(2) + 's');
const fmt  = ms => (ms == null ? '—' : (ms / 1000).toFixed(2) + 's');

const providerLabel = (name, model) => {
  if (name) return name;
  if (!model) return '—';
  return model.includes('/') ? model.split('/')[1] : model;
};

export default function DashboardPage({ runId }) {
  const { runs, loading, error } = useBenchmarkRuns();
  const [tab, setTab] = useState('results');

  const completed = runs.filter(r => r.status === 'completed' && r.turns?.length);

  // If runId is provided, show that run; otherwise latest
  const latest = runId
  ? completed.find(r => String(r.id) === String(runId))
  : completed[completed.length - 1];

  // Derive KPIs from the latest run
  const kpis = latest ? {
    e2e:      { avg: latest.avg_e2e_ms, p50: latest.p50_e2e_ms },
    stt:      { avg: latest.avg_stt_ms, p50: latest.p50_stt_ms },
    llm:      { avg: latest.avg_llm_ms, p50: latest.p50_llm_ms },
    tts:      { avg: latest.avg_tts_ms, p50: latest.p50_tts_ms },
    cost:     latest.cost,
    accuracy: null, // not yet measured; shown as target
  } : null;

  // E2E bar chart: one bar per turn of the latest run
  const barData = latest?.turns?.map((t, i) => ({
    label: `Turn ${i + 1}`,
    value: t.e2e,
  })) ?? [];
  const barMax = Math.max(...barData.map(b => b.value), 1);

  // Line chart: avg e2e per completed run over time
  const lineData = completed.map((r, i) => ({
    label: `R${i + 1}`,
    value: r.avg_e2e_ms,
  }));

  if (loading) {
    return (
      <div style={S.page}>
        <div className="empty" style={{ marginTop: '2rem' }}>Loading runs…</div>
      </div>
    );
  }

  return (
    <div style={S.page}>

      {error && (
        <p style={{ color: '#b42318', fontSize: 13, marginBottom: '1rem' }}>
          {error} — Start the API (<code>cd server && npm run dev</code>).
        </p>
      )}

      {/* ── Page header ── */}
      <div style={S.pageHeader}>
        <div>
          <h1 style={S.h1}>Dashboard</h1>
          <p style={S.subhead}>Performance metrics from the latest benchmark run.</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={S.tabRow}>
        {['results', 'ab'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ ...S.tabBtn, ...(tab === t ? S.tabActive : {}) }}
          >
            {t === 'results' ? 'Results' : 'A/B Comparison'}
          </button>
        ))}
      </div>

      {tab === 'results' && (
        <>
          {!latest && !error && (
            <div className="empty" style={{ marginBottom: '1.5rem' }}>
              No benchmark runs in the database yet.
            </div>
          )}

          {/* ── Latest run banner ── */}
          {latest && (
            <div style={S.latestBanner}>
              <div style={S.latestLeft}>
                <span style={S.latestLabel}>LATEST RUN</span>
                <ProviderPill
                  type="stt"
                  label={providerLabel(latest.stt_provider, latest.stt_model)}
                />
                <span style={S.dot}>·</span>
                <ProviderPill
                  type="llm"
                  label={providerLabel(latest.llm_provider, latest.llm_model)}
                />
                <span style={S.dot}>·</span>
                <ProviderPill
                  type="tts"
                  label={providerLabel(latest.tts_provider, latest.tts_model)}
                />
              </div>
              <button style={S.exportBtn}>
                <div style={S.exportTop}>Export Results</div>
                <div style={S.exportSub}>{latest.started_at?.split(' ')[0] ?? '—'}</div>
              </button>
            </div>
          )}

          {/* ── 6 KPI cards ── */}
          {kpis && (
            <div style={S.kpiGrid}>
              <KpiCard
                label="END-TO-END LATENCY"
                value={fmt(kpis.e2e.avg)}
                sub={`P50: ${fmt(kpis.e2e.p50)}`}
              />
              <KpiCard
                label="STT LATENCY"
                value={fmt(kpis.stt.avg)}
                sub={`P50: ${fmt(kpis.stt.p50)}`}
              />
              <KpiCard
                label="LLM LATENCY"
                value={fmt(kpis.llm.avg)}
                sub={`P50: ${fmt(kpis.llm.p50)}`}
              />
              <KpiCard
                label="TTS LATENCY"
                value={fmt(kpis.tts.avg)}
                sub={`P50: ${fmt(kpis.tts.p50)}`}
              />
              <KpiCard
                label="COST PER RUN"
                value="—"
                sub={<span style={S.targetText}>No data yet</span>}
              />
              <KpiCard
                label="TOOL CALL ACCURACY"
                value="—"
                sub={<span style={S.targetText}>No data yet</span>}
              />
            </div>
          )}

          {/* ── Two charts ── */}
          <div style={S.chartsRow}>
            {/* E2E bar chart */}
            <div style={S.chartCard}>
              <div style={S.chartTitle}>E2E LATENCY — BAR CHART</div>
              <div style={S.barChartWrap}>
                {barData.map((b, i) => {
                  const pct = (b.value / barMax) * 100;
                  return (
                    <div key={i} style={S.barCol}>
                      <div style={S.barValLabel}>{(b.value / 1000).toFixed(2)}s</div>
                      <div style={S.barTrack}>
                        <div style={{ ...S.barFill, height: `${pct}%` }} />
                      </div>
                      <div style={S.barXLabel}>{b.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Latency over time line chart (SVG) */}
            <div style={S.chartCard}>
              <div style={S.chartTitle}>LATENCY OVER TIME</div>
              <LineChart data={lineData} />
            </div>
          </div>

          {/* ── Results table ── */}
          <div className="table-wrap" style={{ marginTop: '1.25rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Run</th>
                  <th>LLM</th>
                  <th>Avg E2E</th>
                  <th>P50 E2E</th>
                  <th>Avg STT</th>
                  <th>Avg LLM</th>
                  <th>Avg TTS</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {completed.length === 0 ? (
                  <tr><td colSpan={8} className="empty">No completed runs.</td></tr>
                ) : completed.map((r, i) => (
                  <tr key={r.id}>
                    <td className="primary" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      R{i + 1}
                    </td>
                    <td className="primary">{r.llm_model}</td>
                    <td>{ms2s(r.avg_e2e_ms)}</td>
                    <td>{ms2s(r.p50_e2e_ms)}</td>
                    <td>{ms2s(r.avg_stt_ms)}</td>
                    <td>{ms2s(r.avg_llm_ms)}</td>
                    <td>{ms2s(r.avg_tts_ms)}</td>
                    <td>${r.cost?.toFixed(3) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'ab' && (
        <ABComparison runs={completed} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components (local — only used on this page)
// ─────────────────────────────────────────────────────────────────────────────

function ProviderPill({ type, label }) {
  const colors = {
    stt: { bg: '#E0EDFF', color: '#3A5FA0', border: '#B0CCEE' },
    llm: { bg: '#DFF5E1', color: '#2A6B34', border: '#A8D8AC' },
    tts: { bg: '#E8F5E0', color: '#3A6B28', border: '#B0D8A0' },
  };
  const c = colors[type];
  // strip provider prefix for display
  const display = label.includes('/') ? label.split('/')[1] : label;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: c.bg, color: c.color,
      border: `0.5px solid ${c.border}`,
      borderRadius: 20, padding: '3px 10px',
      fontSize: 12, fontWeight: 500,
    }}>
      <span style={{ textTransform: 'uppercase', fontSize: 10, opacity: 0.7 }}>{type}</span>
      {display}
    </span>
  );
}

function KpiCard({ label, value, sub }) {
  return (
    <div style={S.kpiCard}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={S.kpiValue}>{value}</div>
      <div style={S.kpiSub}>{sub}</div>
    </div>
  );
}

// SVG line chart — draws avg e2e per run
function LineChart({ data }) {
  if (data.length < 2) return <div className="empty">Need 2+ runs.</div>;
  const W = 320, H = 140, PAD = { t: 20, r: 20, b: 30, l: 40 };
  const xs = data.map((_, i) => PAD.l + (i / (data.length - 1)) * (W - PAD.l - PAD.r));
  const vals = data.map(d => d.value);
  const min  = Math.min(...vals) * 0.85;
  const max  = Math.max(...vals) * 1.1;
  const ys   = vals.map(v => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b));

  const polyline = xs.map((x, i) => `${x},${ys[i]}`).join(' ');

  // Y axis labels
  const yTicks = [min, (min + max) / 2, max].map(v => ({
    val: (v / 1000).toFixed(1) + 's',
    y: PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 160 }}>
      {/* grid lines */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={t.y} x2={W - PAD.r} y2={t.y}
            stroke="rgba(124,111,205,0.15)" strokeWidth={1} />
          <text x={PAD.l - 4} y={t.y + 4} textAnchor="end"
            fontSize={9} fill="#9a9a96">{t.val}</text>
        </g>
      ))}
      {/* shaded area under line */}
      <polygon
        points={`${xs[0]},${H - PAD.b} ${polyline} ${xs[xs.length - 1]},${H - PAD.b}`}
        fill="rgba(124,111,205,0.12)"
      />
      {/* line */}
      <polyline points={polyline} fill="none" stroke="#7C6FCD" strokeWidth={2} strokeLinejoin="round" />
      {/* dots */}
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r={3.5} fill="#7C6FCD" />
      ))}
      {/* x axis labels */}
      {data.map((d, i) => (
        <text key={i} x={xs[i]} y={H - 6} textAnchor="middle"
          fontSize={9} fill="#9a9a96">{d.label}</text>
      ))}
    </svg>
  );
}

// A/B comparison tab — side-by-side metric cards per run
function ABComparison({ runs }) {
  if (runs.length < 2) {
    return <div className="empty" style={{ marginTop: '2rem' }}>Run at least 2 benchmarks to compare.</div>;
  }
  const metrics = [
    { key: 'avg_e2e_ms', label: 'Avg E2E' },
    { key: 'avg_stt_ms', label: 'Avg STT' },
    { key: 'avg_llm_ms', label: 'Avg LLM' },
    { key: 'avg_tts_ms', label: 'Avg TTS' },
    { key: 'cost',       label: 'Cost',    fmt: v => `$${v?.toFixed(3)}` },
  ];

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `140px ${runs.map(() => '1fr').join(' ')}`, gap: 12 }}>
        {/* Header row */}
        <div />
        {runs.map((r, i) => (
          <div key={i} style={S.abHeader}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>R{i + 1}</div>
            <div style={{ fontSize: 11, color: '#9B8FE0', marginTop: 2 }}>
              {r.llm_model?.split('/')[1] ?? r.llm_model}
            </div>
          </div>
        ))}
        {/* Metric rows */}
        {metrics.map(m => {
          const vals = runs.map(r => r[m.key]).filter(v => v != null);
          const best = vals.length ? Math.min(...vals) : null;
          return [
            <div key={`lbl-${m.key}`} style={S.abLabel}>{m.label}</div>,
            ...runs.map((r, i) => {
              const v   = r[m.key];
              const isBest = v != null && best != null && v === best;
              const display = v == null
                ? '—'
                : (m.fmt ? m.fmt(v) : ms2s(v));
              return (
                <div key={`${m.key}-${i}`} style={{ ...S.abCell, ...(isBest ? S.abBest : {}) }}>
                  {display}
                  {isBest && <span style={S.bestTag}>best</span>}
                </div>
              );
            }),
          ];
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — purple theme from wireframe
// ─────────────────────────────────────────────────────────────────────────────
const PURPLE = '#7C6FCD';
const PURPLE_LIGHT = '#F0EEFF';
const PURPLE_MID   = '#E4E0F8';

const S = {
  page:    { padding: '2rem', maxWidth: 1100 },
  pageHeader: { marginBottom: '1rem' },
  h1:      { fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 },
  subhead: { fontSize: 13, color: 'var(--text-secondary)' },

  // Tabs
  tabRow:  { display: 'flex', gap: 8, marginBottom: '1.5rem' },
  tabBtn:  {
    fontSize: 13, fontWeight: 500, padding: '7px 16px',
    borderRadius: 20, border: '0.5px solid var(--border-mid)',
    background: 'var(--bg-primary)', color: 'var(--text-secondary)',
    cursor: 'pointer', transition: 'all 0.15s',
  },
  tabActive: {
    background: 'var(--text-primary)', color: 'var(--bg-primary)',
    border: '0.5px solid var(--text-primary)',
  },

  // Latest run banner
  latestBanner: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'var(--bg-primary)', border: '0.5px solid var(--border-subtle)',
    borderRadius: 12, padding: '14px 20px', marginBottom: '1.25rem',
    flexWrap: 'wrap', gap: 12,
  },
  latestLeft:  { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  latestLabel: { fontSize: 11, fontWeight: 600, color: PURPLE, letterSpacing: '0.06em' },
  dot:         { color: 'var(--text-tertiary)', fontSize: 16 },
  exportBtn:   {
    background: PURPLE_LIGHT, border: `0.5px solid ${PURPLE_MID}`,
    borderRadius: 8, padding: '8px 16px', cursor: 'pointer', textAlign: 'center',
  },
  exportTop:   { fontSize: 13, fontWeight: 600, color: PURPLE },
  exportSub:   { fontSize: 11, color: '#9B8FE0', marginTop: 2 },

  // KPI grid — 3 columns, 2 rows
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    marginBottom: '1.25rem',
  },
  kpiCard: {
    background: 'var(--bg-primary)',
    border: '0.5px solid var(--border-subtle)',
    borderRadius: 12, padding: '1.1rem 1.25rem',
  },
  kpiLabel: { fontSize: 11, fontWeight: 600, color: PURPLE, letterSpacing: '0.05em', marginBottom: 8 },
  kpiValue: { fontSize: 30, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 },
  kpiSub:   { fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 },
  targetText: { color: '#C47E2A', fontWeight: 500 },

  // Charts row
  chartsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 0 },
  chartCard: {
    background: 'var(--bg-primary)',
    border: '0.5px solid var(--border-subtle)',
    borderRadius: 12, padding: '1.1rem 1.25rem',
  },
  chartTitle: {
    fontSize: 11, fontWeight: 600, color: PURPLE,
    letterSpacing: '0.06em', marginBottom: '1rem',
  },

  // Vertical bar chart
  barChartWrap: {
    display: 'flex', alignItems: 'flex-end', gap: 16,
    height: 160, paddingBottom: 24, position: 'relative',
  },
  barCol:     { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' },
  barValLabel:{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 },
  barTrack:   { width: '100%', background: PURPLE_LIGHT, borderRadius: '4px 4px 0 0', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', flex: 1 },
  barFill:    { width: '100%', background: `linear-gradient(180deg, ${PURPLE} 0%, #B0A5F0 100%)`, borderRadius: '4px 4px 0 0', transition: 'height 0.5s ease' },
  barXLabel:  { fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 },

  // A/B tab
  abHeader: {
    background: PURPLE_LIGHT, borderRadius: 8, padding: '10px 14px',
    textAlign: 'center', border: `0.5px solid ${PURPLE_MID}`,
  },
  abLabel: { display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 },
  abCell:  {
    background: 'var(--bg-primary)', border: '0.5px solid var(--border-subtle)',
    borderRadius: 8, padding: '10px 14px', textAlign: 'center',
    fontSize: 14, fontWeight: 500, color: 'var(--text-primary)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
  },
  abBest:  { background: PURPLE_LIGHT, borderColor: PURPLE_MID },
  bestTag: { fontSize: 10, background: PURPLE, color: '#fff', borderRadius: 4, padding: '1px 6px' },
};
