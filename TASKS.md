# Threadline - Social Network Builder

## Project Initialization
- [x] Initialize project structure (root, apps/ui, apps/scraper, src-tauri)
- [x] Create Implementation Plan (`implementation_plan.md`)

## Core Architecture Setup
- [x] **UI Layer**: Set up React + Vite project in `apps/ui`
- [x] **Native Wrapper**: Set up Tauri in `src-tauri`
- [x] **Scraper Engine**: Set up Node.js project in `apps/scraper`

## Feature Implementation
- [x] **Native Integration**: Configure Tauri to spawn/manage Scraper sidecar
- [x] **IPC/Communication**: Implement communication between UI/Tauri and Scraper (HTTP/IPC)
- [x] **Visualization**: Add basic Three.js/ForceGraph component in UI
- [x] **Data Layer**: Implement local database setup (SQLite via Tauri or Scraper)

## Verification
- [x] Verify application builds on Linux
- [x] Verify Scraper process starts/stops with App
- [x] Verify IPC communication

See `VERIFICATION.md` for verification steps and `.github/workflows/build.yml` for Linux CI.
