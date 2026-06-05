// Modal panel shown while a local console benchmark is running.

export default function BenchmarkRunPanel({ status, onDismiss }) {
  if (!status) return null;

  const isActive = status.phase === "starting" || status.phase === "waiting";
  const tone =
    status.phase === "error" || status.phase === "timeout"
      ? "error"
      : status.phase === "completed"
        ? "success"
        : "info";

  return (
    <div style={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="benchmark-run-title">
      <div style={{ ...styles.panel, ...styles[`panel_${tone}`] }}>
        <h2 id="benchmark-run-title" style={styles.title}>
          {status.phase === "starting" && "Starting agent…"}
          {status.phase === "waiting" && "Voice benchmark in progress"}
          {status.phase === "completed" && "Benchmark complete"}
          {status.phase === "timeout" && "Still waiting for results"}
          {status.phase === "error" && "Could not start benchmark"}
        </h2>

        <p style={styles.message}>{status.message}</p>

        {isActive && (
          <div style={styles.steps}>
            <p style={styles.stepsTitle}>What to do:</p>
            <ol style={styles.list}>
              <li>A Terminal window runs <code>uv run python src/agent.py console</code>.</li>
              <li>Allow microphone access if macOS prompts you.</li>
              <li>Talk to the agent for a few turns (~3).</li>
              <li>End the session in Terminal (Ctrl+C or quit).</li>
              <li>This panel updates when metrics are saved to the database.</li>
            </ol>
            {status.pipeline && (
              <p style={styles.meta}>
                Pipeline: STT {status.pipeline.stt_model}, LLM {status.pipeline.llm_model}, TTS{" "}
                {status.pipeline.tts_model}
              </p>
            )}
          </div>
        )}

        {!isActive && (
          <button type="button" className="btn btn-solid" style={styles.dismiss} onClick={onDismiss}>
            Close
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 300,
    padding: "1.5rem",
  },
  panel: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 12,
    padding: "1.5rem",
    background: "#fff",
    boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
  },
  panel_info: { border: "1px solid #c7d7fe" },
  panel_success: { border: "1px solid #abefc6" },
  panel_error: { border: "1px solid #fecdca" },
  title: { fontSize: 18, fontWeight: 600, marginBottom: "0.5rem" },
  message: { fontSize: 14, color: "#344054", lineHeight: 1.5 },
  steps: { marginTop: "1rem" },
  stepsTitle: { fontSize: 13, fontWeight: 600, marginBottom: "0.35rem" },
  list: { fontSize: 13, color: "#344054", paddingLeft: "1.2rem", lineHeight: 1.6 },
  meta: { fontSize: 12, color: "#667085", marginTop: "0.75rem" },
  dismiss: { marginTop: "1rem" },
};
