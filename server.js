/**
 * Single entry: HTTP server (API + optional static UI) and browser lifecycle.
 * - Dev: ui/dist missing → API on first free port in [API_PORT..+20] (default 3000), browser to DEV_UI_PORT (5173, Vite).
 * - Prod: ui/dist exists → static + API on first free port in [PORT..+20] (default 5173), browser to self.
 * GET /api/config returns { port, apiBase } so the UI can discover the backend port when dynamic.
 */
import { createServer } from "http";
import { readFileSync, statSync, existsSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { startBrowser } from "./src/utils/check-browser.js";
import * as scraper from "./src/scraper.js";

// When run from pkg CJS bundle, import.meta is empty; entry.cjs sets THREADLINE_BUNDLE_DIR
const __dirname =
  process.env.THREADLINE_BUNDLE_DIR ||
  dirname(fileURLToPath(import.meta.url));

const UI_DIST_PATH = resolve(__dirname, "ui/dist");
const HAS_STATIC = existsSync(UI_DIST_PATH);

const HOST = "127.0.0.1";
const PREFERRED_PORT = HAS_STATIC
  ? Number(process.env.PORT) || 5173
  : Number(process.env.API_PORT) || 3000;
const PORT_RANGE = 20; // try PREFERRED_PORT .. PREFERRED_PORT + PORT_RANGE - 1
const DEV_UI_PORT = Number(process.env.DEV_UI_PORT) || 5173;

let actualPort = null; // set when server is listening
function getBrowserUrl() {
  if (HAS_STATIC && actualPort != null) return `http://${HOST}:${actualPort}`;
  return `http://${HOST}:${DEV_UI_PORT}`;
}

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
};

function getMimeType(path) {
  const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

function serveFile(filePath, res) {
  try {
    const stats = statSync(filePath);
    if (!stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }
    const content = readFileSync(filePath);
    const mimeType = getMimeType(filePath);
    res.writeHead(200, { "Content-Type": mimeType });
    res.end(content);
  } catch (err) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (ch) => { body += ch; });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function handleApi(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const pathname = (req.url || "").split("?")[0];

  if (pathname === "/api/config" && req.method === "GET") {
    sendJson(res, 200, {
      port: actualPort,
      apiBase: actualPort != null ? `http://${HOST}:${actualPort}` : null,
    });
    return;
  }

  if (pathname === "/api/sessions" && req.method === "GET") {
    try {
      sendJson(res, 200, scraper.getSessions());
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  if (pathname === "/api/scrape" && req.method === "POST") {
    let body;
    try {
      body = await readJson(req);
    } catch (e) {
      sendJson(res, 400, { error: "Invalid JSON" });
      return;
    }
    const { url, session, selector, interactive } = body || {};
    if (!url) {
      sendJson(res, 400, { error: "url is required" });
      return;
    }
    try {
      if (interactive && session) {
        await scraper.runInteractiveScrape(url, session);
        sendJson(res, 200, { ok: true, message: "Session saved" });
        return;
      }
      const data = session
        ? await scraper.scrapeWithSession(url, { session, selector })
        : await scraper.scrapeUrl(url, { selector });
      sendJson(res, 200, data);
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

let browserChild = null;

const server = createServer(async (req, res) => {
  const pathname = req.url === "/" ? "/index.html" : (req.url || "").split("?")[0];

  if (pathname.startsWith("/api/")) {
    await handleApi(req, res);
    return;
  }

  if (HAS_STATIC) {
    const filePath = join(UI_DIST_PATH, pathname);
    serveFile(filePath, res);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

let tryPortIndex = 0;

function tryListen() {
  if (tryPortIndex >= PORT_RANGE) {
    console.error(`No port available in range ${PREFERRED_PORT}–${PREFERRED_PORT + PORT_RANGE - 1}`);
    process.exit(1);
  }
  const port = PREFERRED_PORT + tryPortIndex;
  server.listen(port, HOST, () => {
    actualPort = server.address().port;
    const browserUrl = getBrowserUrl();
    console.log(
      HAS_STATIC
        ? `Server running at ${browserUrl}`
        : `API at http://${HOST}:${actualPort} → browser at ${browserUrl}`
    );
    browserChild = startBrowser(browserUrl, process.env.USER_DATA_DIR || "/tmp/threadline");
    if (browserChild) {
      browserChild.on("exit", (code, signal) => {
        console.log("\nBrowser closed.");
        server.close(() => process.exit(code ?? (signal ? 1 : 0)));
      });
    }
  });
}

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    tryPortIndex += 1;
    tryListen();
  } else {
    console.error(err);
    process.exit(1);
  }
});

tryListen();

function shutdown() {
  console.log("\nShutting down...");
  if (browserChild && !browserChild.killed) {
    browserChild.kill("SIGTERM");
  }
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
