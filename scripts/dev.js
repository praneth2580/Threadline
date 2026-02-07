const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWindows = process.platform === 'win32';
const sep = isWindows ? ';' : ':';
const home = process.env.USERPROFILE || process.env.HOME;
const cargoBin = path.join(home, '.cargo', 'bin');
const cargoPath = path.join(cargoBin, isWindows ? 'cargo.exe' : 'cargo');
// Ensure node/npx are on PATH in the child (same dir as current node executable)
const nodeBin = path.dirname(process.execPath);

function hasCargoInPath() {
  try {
    require('child_process').execSync('cargo --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function hasCargoInCargoBin() {
  return fs.existsSync(cargoPath);
}

function runTauriDev() {
  const root = path.resolve(__dirname, '..');
  const env = { ...process.env };
  // So Tauri's beforeDevCommand (npm run dev --workspace=apps/ui) can find npm
  env.PATH = nodeBin + sep + (env.PATH || '');
  if (hasCargoInCargoBin() && !hasCargoInPath()) {
    env.PATH = cargoBin + sep + env.PATH;
  }
  const tauriJs = path.join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
  const child = spawn(process.execPath, [tauriJs, 'dev'], {
    stdio: 'inherit',
    cwd: root,
    env,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

if (hasCargoInPath() || hasCargoInCargoBin()) {
  runTauriDev();
  return;
}

console.error(`
  Rust/Cargo was not found. The Tauri desktop app needs the Rust toolchain.

  1. Install Rust: https://rustup.rs
  2. Run the installer, then close and reopen this terminal.
  3. Run: npm run dev

  To run only the web UI (no desktop app), use: npm run dev:web
`);
process.exit(1);
