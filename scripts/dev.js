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

function hasPkgConfig() {
  try {
    require('child_process').execSync('pkg-config --version', { stdio: 'ignore' });
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
  
  // So the Rust app can spawn the scraper even when "node" isn't on Cargo's PATH (e.g. nvm/fnm)
  env.THREADLINE_NODE_PATH = process.execPath;
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

if (!hasCargoInPath() && !hasCargoInCargoBin()) {
  console.error(`
  Rust/Cargo was not found. The Tauri desktop app needs the Rust toolchain.

  1. Install Rust: https://rustup.rs
  2. Run the installer, then close and reopen this terminal.
  3. Run: npm run dev

  To run only the web UI (no desktop app), use: npm run dev:web
`);
  process.exit(1);
}

if (process.platform === 'linux' && !hasPkgConfig()) {
  console.error(`
  pkg-config is required to build the Tauri app on Linux but was not found.
  Install it and the other Linux dependencies with:

    sudo apt-get update
    sudo apt-get install -y pkg-config libssl-dev libglib2.0-dev libgtk-3-dev libwebkit2gtk-4.0-dev libayatana-appindicator3-dev librsvg2-dev patchelf

  (libssl-dev is needed for OpenSSL; libayatana-appindicator3-dev on Ubuntu 22.04+. See BUILD.md.)
  Then run: npm run dev
`);
  process.exit(1);
}

runTauriDev();
