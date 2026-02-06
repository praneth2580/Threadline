# Threadline - Social Network Builder

## Project Initialization
- [/] Initialize project structure (root, apps/ui, apps/scraper, src-tauri)
- [x] Create Implementation Plan (`implementation_plan.md`)

## Core Architecture Setup
- [x] **UI Layer**: Set up React + Vite project in `apps/ui`
- [x] **Native Wrapper**: Set up Tauri in `src-tauri`
- [x] **Scraper Engine**: Set up Node.js project in `apps/scraper`

## Feature Implementation
- [ ] **Native Integration**: Configure Tauri to spawn/manage Scraper sidecar
- [ ] **IPC/Communication**: Implement communication between UI/Tauri and Scraper (HTTP/IPC)
- [ ] **Visualization**: Add basic Three.js/ForceGraph component in UI
- [ ] **Data Layer**: Implement local database setup (SQLite via Tauri or Scraper)

## Verification
- [ ] Verify application builds on Linux
- [ ] Verify Scraper process starts/stops with App
- [ ] Verify IPC communication
