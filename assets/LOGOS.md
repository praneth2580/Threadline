# Threadline – Logo assets

Two logo assets were generated for the project:

1. **threadline-logo.png** – Main logo (square). Use in the app header, splash, or marketing. Design: intertwined thread-like lines forming a network, blue–purple gradient, minimal flat style.
2. **threadline-icon.png** – Favicon / small icon (simplified thread/knot). Use as favicon and for small app icons (e.g. 32×32).

## Where to put them

- **Web UI (favicon + header):**  
  Copy into `apps/ui/public/`:
  - `threadline-logo.png` → use in the app (e.g. header) and optionally as `<link rel="icon">` for a larger favicon.
  - `threadline-icon.png` → set as favicon in `apps/ui/index.html`:  
    `<link rel="icon" type="image/png" href="/threadline-icon.png" />`

- **Tauri app icon (Windows/Linux/macOS):**  
  To use the new logo as the desktop app icon:
  1. Copy `threadline-logo.png` (or a 1024×1024 PNG) into the project (e.g. `assets/` or `apps/ui/public/`).
  2. From the repo root run:  
     `npm run tauri icon path/to/threadline-logo.png`  
     This regenerates `src-tauri/icons/` (icon.ico, 32x32.png, 128x128.png, icon.icns).

If the generated files are in Cursor’s assets folder, copy them into `apps/ui/public/` and (optionally) run the Tauri icon command above.
