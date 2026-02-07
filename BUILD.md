# Building Threadline

## Prerequisites

- **Node.js** 18+ and **npm**
- **Rust** (install from https://rustup.rs)
- **Windows**: Visual Studio Build Tools with "Desktop development with C++"
- **Linux**: WebKitGTK and related libs (see below)

---

## Windows (build .exe)

From the project root in a terminal where `npm` and `cargo` are on PATH:

```bash
npm install
npm run build
```

Or use the Tauri CLI directly:

```bash
npm run tauri build
```

**Output:**

- **Installer**: `src-tauri/target/release/bundle/nsis/threadline_0.1.0_x64-setup.exe` (or similar)
- **Portable**: `src-tauri/target/release/bundle/msi/` or `src-tauri/target/release/threadline.exe`

The exact paths depend on your `tauri.conf.json` bundle settings. Check:

```bash
dir src-tauri\target\release\bundle
```

---

## Linux

Tauri doesn’t support cross-compiling from Windows to Linux. You need to build on Linux (native machine, VM, WSL2, or CI).

### 1. Install Linux dependencies (Debian/Ubuntu)

```bash
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev patchelf
```

(Fedora, Arch, etc. use different package names; see [Tauri prerequisites](https://v1.tauri.app/v1/guides/getting-started/prerequisites).)

### 2. Build on the Linux machine

```bash
cd /path/to/Threadline
npm install
npm run build --workspace=apps/ui
npm run tauri build
```

**Output:**

- **Debian/Ubuntu**: `src-tauri/target/release/bundle/deb/*.deb`
- **AppImage**: `src-tauri/target/release/bundle/appimage/*.AppImage`
- **Binary**: `src-tauri/target/release/threadline`

### 3. Using GitHub Actions (no local Linux)

The repo has a workflow that builds on Linux on every push/PR to `main` or `wip/arch-overhaul`:

- Go to **Actions** → **Build** → run the workflow or push to trigger it.
- Download the built artifacts (e.g. `.deb` or AppImage) from the workflow run.

---

## Quick reference

| Goal              | Command           | Where      |
|-------------------|-------------------|------------|
| Windows .exe      | `npm run build`   | Windows PC |
| Linux .deb/AppImage | `npm run tauri build` | Linux / WSL2 / CI |
| Dev (current OS)  | `npm run dev`     | Any        |

If `npm` or `cargo` is not found when building, use a terminal that has them on PATH (e.g. "Node.js command prompt" or restart the terminal after installing Rust).
