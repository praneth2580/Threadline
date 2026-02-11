/**
 * Threadline API router (server-side).
 *
 * This file now handles RECEIVING requests for `/api/*` and implements the API logic
 * that used to live in `server.js`, so `server.js` can focus on:
 * - static file serving
 * - choosing a port
 * - starting/closing the browser window
 */

import * as scraper from "./scraper/main.js";
import { SCRAPER_ADAPTERS } from "./constants/adapters.js";
import { getAccounts, getGraphData } from "./graph-data.js";
import { getTableNames, queryTable } from "./db/db.js";
import { scrapeInstagramAndSave } from "./db/instagram-db.js";

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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

/**
 * Create the `/api/*` request handler.
 * @param {{ host?: string, getPort?: () => number|null }} opts
 */
export function createApiHandler(opts = {}) {
  const host = opts.host || "127.0.0.1";
  const getPort = opts.getPort || (() => null);

  return async function handleApi(req, res) {
    cors(res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const pathname = (req.url || "").split("?")[0];

    // Dynamic route table: method + path → handler
    const routeKey = `${req.method || "GET"} ${pathname}`;
    const routes = {
      "GET /api/config": async () => {
        const port = getPort();
        sendJson(res, 200, {
          port,
          apiBase: port != null ? `http://${host}:${port}` : null,
        });
      },

      "GET /api/sessions": async () => {
        try {
          sendJson(res, 200, scraper.getSessions());
        } catch (e) {
          sendJson(res, 500, { error: e.message });
        }
      },

      "GET /api/adapters": async () => {
        sendJson(res, 200, SCRAPER_ADAPTERS);
      },

      "GET /api/accounts": async () => {
        try {
          const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
          const q = url.searchParams.get("q") || "";
          const platform = url.searchParams.get("platform") || "";
          const list = getAccounts({ q, platform });
          sendJson(res, 200, list);
        } catch (e) {
          sendJson(res, 500, { error: e.message });
        }
      },

      "GET /api/graph": async () => {
        try {
          const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
          const idsParam = url.searchParams.get("accountIds") || url.searchParams.get("ids") || "";
          const accountIds = idsParam
            .split(",")
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !Number.isNaN(n));
          const platform = url.searchParams.get("platform") || "";
          const linkType = url.searchParams.get("linkType") || "";
          const relationDirection = url.searchParams.get("relationDirection") || "";
          const data = getGraphData(accountIds, {
            platform: platform || undefined,
            linkType: linkType || undefined,
            relationDirection: ["followers", "following", "both"].includes(relationDirection) ? relationDirection : undefined,
          });
          sendJson(res, 200, data);
        } catch (e) {
          sendJson(res, 500, { error: e.message });
        }
      },

      "GET /api/db/tables": async () => {
        try {
          const list = getTableNames();
          sendJson(res, 200, list);
        } catch (e) {
          sendJson(res, 500, { error: e.message });
        }
      },

      "GET /api/db/query": async () => {
        try {
          const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
          const table = url.searchParams.get("table") || "";
          const search = url.searchParams.get("search") || "";
          if (!table) {
            sendJson(res, 400, { error: "table is required" });
            return;
          }
          const data = queryTable(table, search || undefined);
          sendJson(res, 200, data);
        } catch (e) {
          sendJson(res, 500, { error: e.message });
        }
      },

      "GET /api/db/instgram": async () => {
        try {
          const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
          const table = url.searchParams.get("table") || "";
          const search = url.searchParams.get("search") || "";
          if (!table) {
            sendJson(res, 400, { error: "table is required" });
            return;
          }
          const data = scrapeInstagramAndSave({
            username,
            session: body.session || undefined,
            includeFollowers: body.includeFollowers === true,
            includeFollowing: body.includeFollowing === true,
            limit: typeof body.limit === "number" ? body.limit : 50,
          });
          sendJson(res, 200, data);
        } catch (e) {
          sendJson(res, 500, { error: e.message });
        }
      },

      
      "POST /api/scrape/instagram": async () => {
        let body;
        try {
          body = await readJson(req);
        } catch (e) {
          sendJson(res, 400, { error: "Invalid JSON" });
          return;
        }
        const username = body?.username?.trim?.() || body?.user?.trim?.();
        if (!username) {
          sendJson(res, 400, { error: "username is required" });
          return;
        }
        try {
          const data = await scrapeInstagramAndSave({
            username,
            session: body.session || undefined,
            includeFollowers: body.includeFollowers === true,
            includeFollowing: body.includeFollowing === true,
            limit: typeof body.limit === "number" ? body.limit : 50,
          });
          sendJson(res, 200, data);
        } catch (e) {
          sendJson(res, 500, { error: e.message });
        }
      },

      "POST /api/scrape": async () => {
        let body;
        try {
          body = await readJson(req);
        } catch (e) {
          sendJson(res, 400, { error: "Invalid JSON" });
          return;
        }

        const { url, session, selector, interactive, strategy, dom, network } = body || {};
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

          const sopts = { session, selector, strategy, dom, network };
          const data = session
            ? await scraper.scrapeWithSession(url, sopts)
            : await scraper.scrapeUrl(url, sopts);
          sendJson(res, 200, data);
        } catch (e) {
          sendJson(res, 500, { error: e.message });
        }
      },
    };

    const handler = routes[routeKey];
    if (!handler) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    await handler();
  };
}

