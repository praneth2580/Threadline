import { contextBridge, ipcRenderer, nativeTheme } from "electron"

function getSystemTheme(): "dark" | "light" {
  return nativeTheme.shouldUseDarkColors ? "dark" : "light"
}

contextBridge.exposeInMainWorld("api", {
  ping: () => "pong",
  getSystemTheme,
  onSystemThemeChange: (callback: (theme: "dark" | "light") => void) => {
    const handler = () => callback(getSystemTheme())
    nativeTheme.on("updated", handler)
    return () => nativeTheme.off("updated", handler)
  },
  db: {
    getTables: () => ipcRenderer.invoke("db:getTables") as Promise<string[]>,
    query: (table: string, search?: string) =>
      ipcRenderer.invoke("db:query", table, search) as Promise<{ columns: string[]; rows: Record<string, unknown>[] }>,
  },
  scraper: {
    scrape: (options: { url: string; waitForSelector?: string; timeout?: number; waitForTimeout?: number; script?: string; returnHtml?: boolean; headers?: Record<string, string>; userAgent?: string }) =>
      ipcRenderer.invoke("scraper:scrape", options),
  },
})
