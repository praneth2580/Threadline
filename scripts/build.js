const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWindows = process.platform === 'win32';
const sep = isWindows ? ';' : ':';
const home = process.env.USERPROFILE || process.env.HOME;
const cargoBin = path.join(home, '.cargo', 'bin');
const cargoPath = path.join(cargoBin, isWindows ? 'cargo.exe' : 'cargo');
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

const root = path.resolve(__dirname, '..');
const env = { ...process.env };
env.PATH = nodeBin + sep + (env.PATH || '');
if (hasCargoInCargoBin() && !hasCargoInPath()) {
  env.PATH = cargoBin + sep + env.PATH;
}

const tauriJs = path.join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
const child = spawn(process.execPath, [tauriJs, 'build'], {
  stdio: 'inherit',
  cwd: root,
  env,
});
child.on('exit', (code) => process.exit(code ?? 0));
