# Threadline – Verification

## Prerequisites

- Node.js 18+
- Rust (stable) + platform toolchain
- npm (from Node.js)

## 1. Verify application builds on Linux

From the project root:

```bash
# Install dependencies
npm install

# Build UI
npm run build --workspace=apps/ui

# Build Tauri (release)
npm run tauri build
```

To verify on Linux without a Linux machine, use Docker:

```bash
docker run --rm -v "$(pwd):/app" -w /app node:20-bookworm-slim bash -c "apt-get update && apt-get install -y curl && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && . $HOME/.cargo/env && npm install && npm run build --workspace=apps/ui && npm run tauri build"
```

Or use GitHub Actions (see `.github/workflows/build.yml` if added).

## 2. Verify Scraper process starts/stops with app

1. Run the app in development: `npm run tauri dev`
2. In the UI, check the status bar: **Scraper** should show `threadline-scraper` (or the JSON response from the scraper).
3. Close the app window.
4. Confirm the scraper process is no longer running (e.g. no `node ... index.js` listening on port 3000).

Optional: run `npx concurrently "npm run scraper:dev" "npm run dev --workspace=apps/ui"` and then start Tauri; with Tauri dev, the app spawns its own scraper, so you may see two scrapers if you also ran `scraper:dev` manually. For verification, use only `npm run tauri dev`.

## 3. Verify IPC communication

1. Start the app: `npm run tauri dev`
2. The UI uses Tauri’s `invoke` to call:
   - `scraper_request` → HTTP GET to `http://127.0.0.1:3000/` (scraper).
   - `db_query` → SQLite query via `db_query` command.
3. Status bar should show:
   - **Scraper:** `threadline-scraper` (or similar) when the scraper is reachable.
   - **DB:** `OK` when SQLite is initialized and a simple query succeeds.
4. If scraper is not running or not reachable, **Scraper** will show an error; if DB init fails, **DB** will show an error.

## Quick checklist

- [ ] `npm install` and `npm run build --workspace=apps/ui` succeed
- [ ] `npm run tauri build` succeeds (on your OS; for Linux use Docker or a Linux host)
- [ ] `npm run tauri dev` starts the app and the scraper (status bar shows scraper and DB OK)
- [ ] Closing the app stops the scraper (no stray node process on 3000)
