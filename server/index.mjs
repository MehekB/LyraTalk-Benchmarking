import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import benchmarkRunsRouter from "./routes/benchmarkRuns.js";
import benchmarkSessionsRouter from "./routes/benchmarkSessions.js";
import providersRouter from "./routes/providers.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
    ],
  })
);

app.use("/api/providers", providersRouter(pool));
app.use("/api/benchmark-runs", benchmarkRunsRouter(pool));
app.use("/api/benchmark-sessions", benchmarkSessionsRouter());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`API listening on http://127.0.0.1:${PORT}`);
});
