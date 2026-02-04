import { app, BrowserWindow, ipcMain, nativeTheme } from "electron"
import path from "path"
import { getTableNames, initDb, queryTable } from "./db"
import { closeScraper, scrape, type ScrapeOptions } from "./scraper"

// Linux: avoid D-Bus scope error and /dev/shm shared-memory issues (e.g. Snap, restricted envs)
if (process.platform === "linux") {
  app.commandLine.appendSwitch("no-sandbox")
  app.commandLine.appendSwitch("disable-dev-shm-usage")
}

const isWindows = process.platform === "win32"

function getWindowColors() {
  const dark = nativeTheme.shouldUseDarkColors
  return dark
    ? { bg: "#0d0d0d", bar: "#1a1a1a", symbol: "#ffffff" }
    : { bg: "#f5f5f5", bar: "#ffffff", symbol: "#000000" }
}

function createWindow() {
  const colors = getWindowColors()
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: colors.bg,
    show: false,
    title: "Threadline",
    ...(isWindows && {
      titleBarOverlay: {
        color: colors.bar,
        symbolColor: colors.symbol,
        height: 40
      }
    }),
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  })

  nativeTheme.on("updated", () => {
    const c = getWindowColors()
    win.setBackgroundColor(c.bg)
    if (isWindows && typeof (win as unknown as { setTitleBarOverlay?: (o: unknown) => void }).setTitleBarOverlay === "function") {
      (win as unknown as { setTitleBarOverlay: (o: { color: string; symbolColor: string; height: number }) => void }).setTitleBarOverlay({ color: c.bar, symbolColor: c.symbol, height: 40 })
    }
  })

  win.once("ready-to-show", () => win.show())

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile("../ui/dist/index.html")
  }
}

app.whenReady().then(() => {
  initDb(app.getPath("userData"))
  ipcMain.handle("db:getTables", () => getTableNames())
  ipcMain.handle("db:query", (_event, table: string, search?: string) => queryTable(table, search))
  ipcMain.handle("scraper:scrape", (_event, options: ScrapeOptions) => scrape(options))
  createWindow()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

app.on("before-quit", () => {
  closeScraper()
})
