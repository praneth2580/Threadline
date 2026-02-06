import { app, BrowserWindow, ipcMain, nativeTheme } from "electron";
import path from "path";
import { getTableNames, initDb, queryTable } from "./db";
import { log } from "./logger";
import { closeScraper, scrape, type ScrapeOptions } from "./scraper";

const isWindows = process.platform === "win32";
const devUrl =
  process.argv.find((a) => a.startsWith("--vite-dev-url="))?.split("=")[1] ??
  process.env.VITE_DEV_SERVER_URL;
const isDev = !!devUrl;

log("main", "init: platform =", process.platform, "devUrl =", devUrl, "isDev =", isDev);

if (process.platform === "linux") {
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-dev-shm-usage");
  app.disableHardwareAcceleration();
}

function createWindow() {
  log("main", "createWindow: start");
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: true, // Force show for debugging
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0d0d0d" : "#f5f5f5",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: !isDev, // Disable webSecurity in dev just in case
    },
  });

  if (isDev) {
    win.webContents.openDevTools({ mode: "right" });
  }

  // Log failures
  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    log("main", "did-fail-load:", errorCode, errorDescription);
  });

  win.once("ready-to-show", () => {
    log("main", "ready-to-show");
    win.show();
  });

  if (devUrl) {
    log("main", "loading URL:", devUrl);
    win.loadURL(devUrl).catch((e) => {
      log("main", "failed to load URL:", e);
    });
  } else {
    const indexPath = path.join(app.getAppPath(), "ui", "dist", "index.html");
    log("main", "loading file:", indexPath);
    win.loadFile(indexPath).catch((e) => {
      log("main", "failed to load file:", e);
    });
  }
}

app.whenReady().then(() => {
  log("main", "app.whenReady");

  // Initialize DB
  try {
    const userData = app.getPath("userData");
    initDb(userData);

    // Register DB Handlers which were causing issues if called before init
    ipcMain.handle("db:getTables", () => getTableNames());
    ipcMain.handle("db:query", (_event, table: string, search?: string) => queryTable(table, search));
    log("main", "DB initialized and handlers registered");
  } catch (e) {
    console.error("Failed to initialize DB:", e);
    log("main", "Failed to initialize DB:", e);
  }

  ipcMain.handle("scraper:scrape", (_event, options: ScrapeOptions) => scrape(options));
  ipcMain.handle("scraper:getSessions", () => import("./scraper").then(m => m.getSessions()));
  ipcMain.handle("scraper:getAdapters", () => import("./scraper").then(m => m.getAdapters()));
  ipcMain.handle("scraper:saveAdapter", (_event, adapter) => import("./scraper").then(m => m.saveAdapter(adapter)));

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  closeScraper();
});
