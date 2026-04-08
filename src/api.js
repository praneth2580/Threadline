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
import { PLATFORM_IDS } from "./constants/platforms.js";
import { getAccounts, getGraphData } from "./graph-data.js";
import { getTableNames, queryTable, deleteRow } from "./db/db.js";
import { scrapeInstagramAndSave } from "./db/instagram-db.js";
import { getSelectorOverride, setSelectorOverride } from "./scraper/selector-store.js";
import { ollamaProposeListSelector, isOllamaAvailable } from "./scraper/ollama.js";

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

      "DELETE /api/db/row": async () => {
        try {
          const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
          const table = url.searchParams.get("table");
          const pk = url.searchParams.get("pk");
          const id = url.searchParams.get("id");

          if (!table || !pk || !id) {
            sendJson(res, 400, { error: "Missing table, pk, or id" });
            return;
          }

          deleteRow(table, pk, id);
          sendJson(res, 200, { success: true });
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
            // Fire-and-forget: keep the API responsive while the user logs in.
            // The Playwright window stays open until the user closes it.
            scraper.runInteractiveScrape(url, session).catch((e) => {
              console.error("[api] interactive scrape failed:", e);
            });
            sendJson(res, 200, { ok: true, message: "Browser opened for login" });
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

      /**
       * Self-healing scrape: frontend sends only { platform, identifier, type }.
       * Backend:
       * - builds URL
       * - tries saved selector (from selector-store override, else static adapter)
       * - if extraction fails, uses Ollama to propose a new selector
       * - validates and persists the selector for future runs
       */
      "POST /api/scrape/auto": async () => {
        let body;
        try {
          body = await readJson(req);
        } catch {
          sendJson(res, 400, { error: "Invalid JSON" });
          return;
        }

        const platform = String(body?.platform || "").trim().toLowerCase();
        const type = String(body?.type || "").trim().toLowerCase();
        const identifierRaw = String(body?.identifier || body?.accountIdentifier || "").trim();
        const identifier = identifierRaw.replace(/^@/, "");

        if (!platform || !PLATFORM_IDS.includes(platform)) {
          sendJson(res, 400, { error: "platform is required and must be a known platform id" });
          return;
        }
        if (!type) {
          sendJson(res, 400, { error: "type is required" });
          return;
        }
        if (!identifier) {
          sendJson(res, 400, { error: "identifier is required" });
          return;
        }

        // Resolve URL (best-effort; instagram is special-cased)
        let url = "";
        if (platform === "instagram") {
          if (type === "profile") url = `https://www.instagram.com/${identifier}/`;
          else if (type === "followers") url = `https://www.instagram.com/${identifier}/followers/`;
          else if (type === "following") url = `https://www.instagram.com/${identifier}/following/`;
          else url = `https://www.instagram.com/${identifier}/`;
        } else {
          const adapter = SCRAPER_ADAPTERS.find((a) => String(a.profileUrlTemplate || "").includes(`${platform}.`));
          const tpl = adapter?.profileUrlTemplate || `https://${platform}.com/u/{id}`;
          url = tpl.replace("{id}", identifier);
        }

        // Pick a session if available (platform-main is the convention in Accounts UI)
        const sessions = scraper.getSessions();
        const session =
          sessions.find((s) => s.toLowerCase() === `${platform}-main`) ||
          sessions.find((s) => s.toLowerCase().startsWith(`${platform}-`)) ||
          null;

        // Determine starting selector
        const override = getSelectorOverride(platform, type);
        const adapterDefault = SCRAPER_ADAPTERS.find((a) => (a.baseUrl || "").includes(`${platform}.`))?.connections?.listSelector;
        const listSelector = override?.listSelector || adapterDefault || ".user-list li, .follow-list .item, [data-testid='list-item']";

        const domConfig = { listSelector, fields: { text: "" } };

        const validate = (rows) =>
          Array.isArray(rows) && rows.length > 0 && rows.some((r) => typeof r?.text === "string" && r.text.trim().length > 0);

        // First attempt: saved selector
        try {
          const data = session
            ? await scraper.scrapeWithSession(url, { session, strategy: "dom", dom: domConfig })
            : await scraper.scrapeUrl(url, { strategy: "dom", dom: domConfig });

          const extracted = data?.extracted || [];
          if (validate(extracted)) {
            sendJson(res, 200, {
              ok: true,
              platform,
              identifier,
              type,
              url,
              selectorUsed: listSelector,
              selectorUpdated: false,
              extracted,
            });
            return;
          }
        } catch (e) {
          // Continue to repair path below
        }

        // Repair path: ask Ollama for a better selector, validate, persist.
        const ollamaReady = await isOllamaAvailable();
        if (!ollamaReady) {
          sendJson(res, 502, { error: "Selector failed and Ollama is not available for repair." });
          return;
        }

        const html = await scraper.fetchPageHtml(url, { session: session || undefined });
        const proposed = await ollamaProposeListSelector(html, {
          platform,
          type,
          hint: `Need a selector for repeated list rows for ${type}.`,
        });
        if (!proposed?.listSelector) {
          sendJson(res, 500, { error: "AI selector repair failed (no selector returned)." });
          return;
        }

        const repairedDom = { listSelector: proposed.listSelector, fields: { text: "" } };
        try {
          const data2 = session
            ? await scraper.scrapeWithSession(url, { session, strategy: "dom", dom: repairedDom })
            : await scraper.scrapeUrl(url, { strategy: "dom", dom: repairedDom });
          const extracted2 = data2?.extracted || [];
          if (!validate(extracted2)) {
            sendJson(res, 500, { error: "AI proposed selector did not validate.", selectorTried: proposed.listSelector });
            return;
          }

          setSelectorOverride(platform, type, { listSelector: proposed.listSelector });
          sendJson(res, 200, {
            ok: true,
            platform,
            identifier,
            type,
            url,
            selectorUsed: proposed.listSelector,
            selectorUpdated: true,
            extracted: extracted2,
          });
        } catch (e) {
          sendJson(res, 500, { error: e?.message || "AI selector validate scrape failed." });
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

