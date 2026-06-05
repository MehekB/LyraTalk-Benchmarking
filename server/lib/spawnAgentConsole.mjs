import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENT_DIR = path.resolve(__dirname, "../../agent");

let activeChild = null;

function benchmarkApiBase() {
  const explicit = process.env.BENCHMARK_API_BASE?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const port = Number(process.env.PORT) || 3001;
  return `http://127.0.0.1:${port}`;
}

function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** macOS: open a new Terminal window running the local voice agent in console mode. */
function spawnInMacTerminal(command, env) {
  const envExports = Object.entries(env)
    .map(([k, v]) => `export ${k}=${JSON.stringify(String(v))}`)
    .join(" && ");
  const script = `cd ${JSON.stringify(AGENT_DIR)} && ${envExports} && ${command}`;

  const child = spawn(
    "osascript",
    [
      "-e",
      'tell application "Terminal" to activate',
      "-e",
      `tell application "Terminal" to do script ${JSON.stringify(script)}`,
    ],
    { detached: true, stdio: "ignore" }
  );
  child.unref();
  return child;
}

/** Fallback: detached background process (mic works best in an interactive terminal). */
function spawnDetached(command, args, env) {
  const child = spawn(command, args, {
    cwd: AGENT_DIR,
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ...env },
  });
  child.unref();
  return child;
}

export function getAgentConsoleStatus() {
  if (activeChild?.pid && isAlive(activeChild.pid)) {
    return { running: true, pid: activeChild.pid };
  }
  activeChild = null;
  return { running: false, pid: null };
}

/**
 * Start `uv run python src/agent.py console` in a new process.
 * On macOS this opens Terminal so microphone access works.
 */
export function spawnAgentConsole() {
  const status = getAgentConsoleStatus();
  if (status.running) {
    return { ...status, alreadyRunning: true };
  }

  const env = {
    BENCHMARK_API_BASE: benchmarkApiBase(),
  };

  const uvArgs = ["run", "python", "src/agent.py", "console"];
  let launchMethod = "background";

  if (process.platform === "darwin") {
    activeChild = spawnInMacTerminal(`uv run python src/agent.py console`, env);
    launchMethod = "terminal";
  } else {
    activeChild = spawnDetached("uv", uvArgs, env);
  }

  return {
    running: true,
    pid: activeChild.pid ?? null,
    alreadyRunning: false,
    launchMethod,
    agentDir: AGENT_DIR,
    benchmarkApiBase: env.BENCHMARK_API_BASE,
  };
}
