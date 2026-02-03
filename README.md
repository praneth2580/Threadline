# 🧵 Threadline

Threadline is a desktop application that visualizes social relationships as an interactive 3D graph. It allows users to explore followers, following, and mutual connections from a given social profile in a persistent, local-first environment.

Threadline is designed as a single installable desktop app, prioritizing ease of use, portability, and visual clarity over complex server-based systems.

---

## ⚠️ Important Disclaimer

Threadline is an **educational and experimental project**.

- Use of this application is **entirely at your own risk**.
- Threadline is intended only for learning, research, and visualization purposes.
- The project does not encourage or endorse violating the terms of service of any platform.
- Users are responsible for ensuring their usage complies with applicable laws and platform policies.
- The authors of this project take no responsibility for misuse or policy violations.

---

## ✨ What Threadline Does

- Fetches social relationship data (followers / following)
- Stores relationship data locally on the user's machine
- Builds a graph-based representation of connections
- Visualizes relationships in an interactive 3D space
- Helps identify:
  - Mutual connections
  - Clusters and dense communities
  - Direct and indirect relationships

Once data is fetched, it remains available even after restarting the application.

---

## 🎯 Project Goals

Threadline is built with the following principles:

| Principle | Description |
|-----------|-------------|
| **Accessible to non-developers** | No terminal usage or server setup required. |
| **Local-first & offline-friendly** | All data is stored locally and remains available offline. |
| **Visual understanding over lists** | Relationships are easier to grasp spatially than through tables. |
| **Extensible by design** | The architecture allows additional platforms and data sources in the future. |

---

## 🖥️ Why a Desktop Application?

Threadline is desktop-first rather than web-based because:

- It can be distributed as a single installer (`.exe`, `.dmg`)
- No backend server or cloud infrastructure is required
- Sensitive or rate-limited operations stay local
- User data never leaves the machine
- The app remains usable without an internet connection after data is collected

Electron is used to combine modern web technologies with native desktop distribution.

---

## 🧠 High-Level Architecture

Threadline runs entirely on the user's system as a single application.

```
┌────────────────────────────┐
│        Threadline App      │
│                            │
│  ┌───────── UI ─────────┐ │
│  │ React + 3D Graph     │ │
│  └─────────▲───────────┘ │
│            │ IPC           │
│  ┌─────────┴───────────┐ │
│  │ Local Backend        │ │
│  │ Node.js (Electron)  │ │
│  └─────────▲───────────┘ │
│            │              │
│  ┌─────────┴───────────┐ │
│  │ Local Database       │ │
│  │ SQLite               │ │
│  └─────────▲───────────┘ │
│            │              │
│  ┌─────────┴───────────┐ │
│  │ Data Providers       │ │
│  │ (API / Scraper)     │ │
│  └────────────────────┘ │
└────────────────────────────┘
```

There are no exposed servers, no open ports, and no required external services.

---

## 🧩 Core Components

### 1. Frontend (UI Layer)

- Built with **React + Vite**
- Handles:
  - User input (username / ID)
  - Graph interaction
  - Filtering and inspection
- Renders relationships using a 3D force-directed graph

### 2. Local Backend (Logic Layer)

- Runs in Electron's main process
- Responsible for:
  - Fetching and processing data
  - Graph construction
  - Database access
- Communicates with the UI via IPC, not HTTP

### 3. Database (Persistence Layer)

- Uses **SQLite**
- Stores:
  - User nodes
  - Relationship edges
- Data persists across sessions

### 4. Data Providers

- Abstracted behind a provider interface
- Allows switching between:
  - Official APIs
  - Experimental local scrapers
  - Mock providers for testing and demos

---

## 🔌 IPC Communication Model

Threadline avoids running a local web server. Instead, it uses Electron's **Inter-Process Communication (IPC)**:

```
User Action → UI → IPC → Backend → Database → IPC → UI
```

This keeps the app simple, secure, and free of network configuration issues.

---

## 📁 Project Structure

```
threadline/
├── electron/           # Electron main & preload processes
│   ├── main.ts
│   ├── preload.ts
│   └── tsconfig.json
│
├── ui/                 # React frontend
│   ├── src/
│   ├── index.html
│   └── vite.config.ts
│
├── package.json
└── README.md
```

Each layer is intentionally separated to keep responsibilities clear.

---

## 🚀 Development Setup

### Prerequisites

- **Node.js** (LTS recommended)
- **npm**

### Install dependencies

```bash
npm install
cd ui
npm install
cd ..
```

### Run in development mode

```bash
npm run dev
```

This starts:

- The Vite development server
- The Electron desktop application

---

## 📦 Distribution

Threadline is designed to be packaged as a native desktop installer:

- **Windows:** `.exe`
- **macOS:** `.dmg`
- **Linux:** `.AppImage`

End users install and run it like any normal desktop application.

---

## 🔒 Privacy Notes

- All data is stored locally
- No telemetry or analytics
- No automatic uploads
- No shared databases
- Users maintain full control over their data at all times

---

## 🛣️ Roadmap

Planned future improvements include:

- Enhanced 3D interaction controls
- Graph snapshots over time
- Exporting graphs as images or files
- Comparing multiple profiles
- Support for additional platforms

---

## 🧭 Philosophy

Threadline treats social networks as **threads of connection**, not feeds or metrics. It focuses on making invisible relationships visible, explorable, and understandable.
