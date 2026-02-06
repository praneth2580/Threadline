#!/usr/bin/env node
/**
 * Launches Electron with TMPDIR set to a project-local directory.
 * Filters Chromium shared-memory stderr noise on Linux (ESRCH in restricted envs).
 * Loads .env.dev then .env (if present) so env vars are picked up. Set THREADLINE_DEBUG=1 for step logs.
 */
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..");
// Load env files ( .env.dev first, then .env to override )
require("dotenv").config({ path: path.join(root, ".env.dev") });
require("dotenv").config({ path: path.join(root, ".env") });

const debug =
  process.env.THREADLINE_DEBUG === "1" || process.env.THREADLINE_DEBUG === "true";
function log(...args) {
  if (debug) console.log("[electron-dev]", ...args);
}

log("Step 1: Resolving paths");
const tmpDir = path.join(root, ".electron-tmp");
log("  root =", root);
log("  tmpDir =", tmpDir);

log("Step 2: Creating .electron-tmp");
fs.mkdirSync(tmpDir, { recursive: true });
log("  done");

log("Step 3: Building env (TMPDIR, VITE_DEV_SERVER_URL, DBUS on Linux)");
const env = {
  ...process.env,
  TMPDIR: tmpDir,
  TEMP: tmpDir,
  TMP: tmpDir,
};
const viteDevUrl = "http://localhost:5173";
if (!env.VITE_DEV_SERVER_URL) env.VITE_DEV_SERVER_URL = viteDevUrl;
if (process.platform === "linux") env.DBUS_SESSION_BUS_ADDRESS = "disabled:";
log("  VITE_DEV_SERVER_URL =", env.VITE_DEV_SERVER_URL);
log("  platform =", process.platform);

log("Step 4: Resolving Electron binary");
const electronBin =
  process.platform === "win32"
    ? path.join(root, "node_modules", ".bin", "electron.cmd")
    : path.join(root, "node_modules", ".bin", "electron");
const binExists = fs.existsSync(electronBin);
log("  electronBin =", electronBin);
log("  exists =", binExists);
if (!binExists) console.error("[electron-dev] ERROR: Electron binary not found. Run: npm install");

// Suppress known Chromium/Linux stderr spam
function isChromiumNoise(line) {
  return (
    /platform_shared_memory_region_posix/.test(line) ||
    /Unable to access\(W_OK\|X_OK\)/.test(line) ||
    /Creating shared memory in .* failed: No such process/.test(line) ||
    /StartTransientUnit|UnitExists|app-org\.chromium\.Chromium.*\.scope/.test(line) ||
    /dbus\/bus\.cc.*Failed to connect to the bus/.test(line) ||
    /dbus\/object_proxy\.cc.*DBus/.test(line)
  );
}

const spawnArgs = [root, `--vite-dev-url=${viteDevUrl}`, ...process.argv.slice(2)];
log("Step 5: Spawning Electron");
log("  args =", spawnArgs);
log("  cwd =", root);

const child = spawn(electronBin, spawnArgs, {
  env,
  stdio: ["inherit", "inherit", "pipe"],
  cwd: root,
});

log("Step 6: Child spawned, pid =", child.pid);
if (!child.pid) console.error("[electron-dev] ERROR: Failed to spawn Electron (no pid)");

let stderrBuf = "";
if (child.stderr) {
  log("Step 7: Piping stderr (filtering Chromium noise)");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderrBuf += chunk;
    const lines = stderrBuf.split(/\r?\n/);
    stderrBuf = lines.pop() || "";
    for (const line of lines) {
      if (line && !isChromiumNoise(line)) process.stderr.write(line + "\n");
    }
  });
  child.stderr.on("end", () => {
    if (stderrBuf && !isChromiumNoise(stderrBuf)) process.stderr.write(stderrBuf);
  });
}

child.on("exit", (code, signal) => {
  log("Step 8: Electron exited: code =", code, "signal =", signal);
  process.exit(code !== null ? code : signal ? 128 + signal : 0);
});
