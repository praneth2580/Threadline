import { contextBridge, ipcRenderer } from "electron";
import { log } from "./logger";

// Safe API object
const api = {
  // Database API
  db: {
    getTables: () => ipcRenderer.invoke("db:getTables"),
    query: (table: string, search?: string) => ipcRenderer.invoke("db:query", table, search),
  },

  // Scraper API
  scraper: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scrape: (options: any) => ipcRenderer.invoke("scraper:scrape", options),
    getSessions: () => ipcRenderer.invoke("scraper:getSessions"),
    getAdapters: () => ipcRenderer.invoke("scraper:getAdapters"),
    saveAdapter: (adapter: any) => ipcRenderer.invoke("scraper:saveAdapter", adapter),
  },

  // Theme API (simplified for now to prevent crashes)
  getSystemTheme: () => "light", // Placeholder to safely default
  onSystemThemeChange: (_cb: (theme: string) => void) => {
    // Placeholder: No-op for now to prevent nativeTheme crash in renderer
    return () => { };
  },

  // Ping
  ping: () => "pong",
};

log("preload", "Exposing API");

try {
  contextBridge.exposeInMainWorld("api", api);
  log("preload", "API exposed successfully");
} catch (e) {
  console.error("Failed to expose API:", e);
  log("preload", "Failed to expose API:", e);
}
