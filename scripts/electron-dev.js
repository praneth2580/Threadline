#!/usr/bin/env node
/**
 * Launches Electron with TMPDIR set to a project-local directory.
 * Filters Chromium shared-memory stderr noise on Linux (ESRCH in restricted envs).
 */
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..");
const tmpDir = path.join(root, ".electron-tmp");
fs.mkdirSync(tmpDir, { recursive: true });

const env = {
  ...process.env,
  TMPDIR: tmpDir,
  TEMP: tmpDir,
  TMP: tmpDir,
};
if (!env.VITE_DEV_SERVER_URL) env.VITE_DEV_SERVER_URL = "http://localhost:5173";
// Linux: avoid Chromium creating systemd scope (UnitExists / StartTransientUnit D-Bus error)
if (process.platform === "linux") env.DBUS_SESSION_BUS_ADDRESS = "disabled:";

const electronBin =
  process.platform === "win32"
    ? path.join(root, "node_modules", ".bin", "electron.cmd")
    : path.join(root, "node_modules", ".bin", "electron");

// Suppress known Chromium/Linux stderr spam
function isChromiumNoise(line) {
  return (
    /platform_shared_memory_region_posix/.test(line) ||
    /Unable to access\(W_OK\|X_OK\)/.test(line) ||
    /Creating shared memory in .* failed: No such process/.test(line) ||
    /StartTransientUnit|UnitExists|app-org\.chromium\.Chromium.*\.scope/.test(line)
  );
}

const child = spawn(electronBin, [root, ...process.argv.slice(2)], {
  env,
  stdio: ["inherit", "inherit", "pipe"],
  cwd: root,
});

let stderrBuf = "";
if (child.stderr) {
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
  process.exit(code !== null ? code : signal ? 128 + signal : 0);
});
