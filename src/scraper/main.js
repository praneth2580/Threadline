/**
 * Scraper: common utils + extraction strategies (DOM/network) + sessions + scrapeUrl / scrapeWithSession.
 * Import from here or from '../scraper.js' (re-export): getSessions, scrapeUrl, scrapeWithSession, runInteractiveScrape, extractFromDom, etc.
 */
import * as cheerio from "cheerio";
import { parseHtmlForAi } from "../utils/html-parser.js";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// ---------------------------------------------------------------------------
// Delays & rate limiting
// ---------------------------------------------------------------------------

/** Wait ms milliseconds. */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Random delay between min and max ms (e.g. to avoid strict rate limits). */
export function randomDelay(minMs = 500, maxMs = 2000) {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return sleep(ms);
}

// ---------------------------------------------------------------------------
// HTTP / fetch
// ---------------------------------------------------------------------------

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

/**
 * Fetch with timeout and optional custom headers.
 * @param {string} url
 * @param {{ timeout?: number, headers?: Record<string, string>, signal?: AbortSignal }} opts
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, opts = {}) {
  const { timeout = 15000, headers = {}, signal } = opts;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  const res = await fetch(url, {
    headers: { ...DEFAULT_HEADERS, ...headers },
    redirect: "follow",
    signal: signal || ctrl.signal,
  });
  clearTimeout(t);
  return res;
}

/**
 * Fetch with retries and optional delay between retries.
 * @param {string} url
 * @param {{ retries?: number, delayMs?: number, timeout?: number, headers?: Record<string, string> }} opts
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, opts = {}) {
  const { retries = 3, delayMs = 1000, timeout = 15000, headers = {} } = opts;
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetchWithTimeout(url, { timeout, headers });
      if (res.ok || i === retries) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    if (i < retries) await sleep(delayMs);
  }
  throw lastErr;
}

/**
 * Fetch URL and return response text. Throws on non-OK or timeout.
 */
export async function fetchText(url, opts = {}) {
  const res = await fetchWithRetry(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

/**
 * Fetch URL and return parsed JSON. Throws on non-OK, timeout, or invalid JSON.
 */
export async function fetchJson(url, opts = {}) {
  const res = await fetchWithRetry(url, {
    ...opts,
    headers: { Accept: "application/json", ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// User-Agent helpers
// ---------------------------------------------------------------------------

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

/** Pick a random user-agent string. */
export function randomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/** Headers object with a random User-Agent. */
export function headersWithRandomUA(extra = {}) {
  return { ...DEFAULT_HEADERS, "User-Agent": randomUserAgent(), ...extra };
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/**
 * Normalize URL: trim, add protocol if missing, remove trailing slash from path (optional).
 * @param {string} url
 * @param {{ defaultProtocol?: string, stripTrailingSlash?: boolean }} opts
 */
export function normalizeUrl(url, opts = {}) {
  const { defaultProtocol = "https:", stripTrailingSlash = false } = opts;
  if (!url || typeof url !== "string") return "";
  let s = url.trim();
  if (!/^https?:\/\//i.test(s)) s = `${defaultProtocol}//${s.replace(/^\/+/, "")}`;
  try {
    const u = new URL(s);
    if (stripTrailingSlash && u.pathname !== "/" && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.href;
  } catch {
    return s;
  }
}

/** Resolve a relative or absolute href against a base URL. */
export function resolveUrl(baseUrl, href) {
  if (!href || !href.trim()) return "";
  try {
    return new URL(href.trim(), baseUrl).href;
  } catch {
    return href;
  }
}

/** Build query string from object (ignores null/undefined). */
export function buildQuery(params) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") search.set(k, String(v));
  }
  const q = search.toString();
  return q ? `?${q}` : "";
}

// ---------------------------------------------------------------------------
// HTML / text
// ---------------------------------------------------------------------------

/** Strip HTML tags and normalize whitespace to single spaces, then trim. */
export function stripHtml(html) {
  if (!html) return "";
  return String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Trim and collapse internal whitespace to single space. */
export function normalizeWhitespace(str) {
  if (!str) return "";
  return String(str).replace(/\s+/g, " ").trim();
}

/** Truncate string to maxLen, with optional suffix (e.g. '...'). */
export function truncate(str, maxLen, suffix = "…") {
  if (!str) return "";
  const s = String(str);
  if (s.length <= maxLen) return s;
  return s.slice(0, Math.max(0, maxLen - suffix.length)) + suffix;
}

/** Extract first match of regex from string; returns null if no match. */
export function extractFirst(str, regex) {
  if (!str) return null;
  const m = String(str).match(regex);
  return m ? m[1] ?? m[0] : null;
}

// ---------------------------------------------------------------------------
// Retry / backoff
// ---------------------------------------------------------------------------

/**
 * Run an async function with retries. On failure waits delayMs then retries.
 * @param {() => Promise<T>} fn
 * @param {{ retries?: number, delayMs?: number, backoff?: boolean }} opts
 * @returns {Promise<T>}
 */
export async function withRetry(fn, opts = {}) {
  const { retries = 3, delayMs = 1000, backoff = false } = opts;
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
    }
    if (i < retries) {
      const wait = backoff ? delayMs * Math.pow(2, i) : delayMs;
      await sleep(wait);
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Safe filenames / slugs
// ---------------------------------------------------------------------------

/** Make a string safe for use as a filename (replace unsafe chars with _). */
export function safeFilename(str) {
  if (!str) return "";
  return String(str).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 200);
}

/** Simple slug: lowercase, alphanumeric and hyphens. */
export function slug(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Scraper core: Playwright, extraction strategies, sessions, scrapeUrl / scrapeWithSession
// ---------------------------------------------------------------------------

async function getChromium() {
  // This file runs as an ES module; `require(...)` is not available.
  // Use dynamic import so Playwright remains optional until actually used.
  const pw = await import("playwright");
  return pw.chromium;
}

function isMissingBrowserExecutableError(err) {
  const msg = String(err?.message || err || "");
  return msg.includes("Executable doesn't exist") || msg.includes("download new browsers");
}

function getProfileChannel(profilePath) {
  try {
    const metaPath = join(profilePath, "threadline-browser.json");
    if (!existsSync(metaPath)) return null;
    const raw = readFileSync(metaPath, "utf8");
    const data = JSON.parse(raw);
    const ch = typeof data?.channel === "string" ? data.channel.trim() : "";
    return ch || null;
  } catch {
    return null;
  }
}

function setProfileChannel(profilePath, channel) {
  try {
    const metaPath = join(profilePath, "threadline-browser.json");
    writeFileSync(metaPath, JSON.stringify({ channel: channel || "default", updatedAt: new Date().toISOString() }, null, 2));
  } catch {
    // non-fatal
  }
}

async function launchPersistentContextWithFallback(chromium, profilePath, launchOptions) {
  try {
    // Prefer explicit channel, else stick to the channel that created this profile.
    const preferred =
      (process.env.PLAYWRIGHT_CHANNEL && process.env.PLAYWRIGHT_CHANNEL.trim()) ||
      getProfileChannel(profilePath);

    if (preferred && preferred !== "default") {
      const ctx = await chromium.launchPersistentContext(profilePath, { ...launchOptions, channel: preferred });
      setProfileChannel(profilePath, preferred);
      return ctx;
    }

    const ctx = await chromium.launchPersistentContext(profilePath, launchOptions);
    setProfileChannel(profilePath, "default");
    return ctx;
  } catch (e) {
    if (!isMissingBrowserExecutableError(e)) throw e;

    const channels = [process.env.PLAYWRIGHT_CHANNEL, "msedge", "chrome"].filter(Boolean);
    for (const channel of channels) {
      try {
        const ctx = await chromium.launchPersistentContext(profilePath, { ...launchOptions, channel });
        setProfileChannel(profilePath, channel);
        return ctx;
      } catch (e2) {
        // try next
      }
    }
    throw e;
  }
}

// Extraction strategies: API response (network) vs HTML (DOM)
// POST /api/scrape body: strategy "dom" | "network" | "hybrid", dom: { listSelector, itemSelector?, fields }, network: { urlPattern, jsonPath?, timeout? }

function getByPath(obj, pathStr) {
  if (!pathStr || !pathStr.trim()) return obj;
  let current = obj;
  for (const key of pathStr.split(".")) {
    if (current == null) return undefined;
    current = current[key];
  }
  return current;
}

/**
 * Extract data from HTML using CSS selectors.
 * @param {string} html
 * @param {{ listSelector: string, itemSelector?: string, fields: Record<string, string|{selector: string, attr?: string}> }} config
 */
export function extractFromDom(html, config) {
  const $ = cheerio.load(html);
  const { listSelector, itemSelector, fields } = config;
  const items = itemSelector
    ? $(listSelector).find(itemSelector).toArray()
    : $(listSelector).toArray();
  const result = [];
  for (const el of items) {
    const row = {};
    for (const [key, spec] of Object.entries(fields || {})) {
      const sel = typeof spec === "string" ? spec : spec.selector;
      const attr = typeof spec === "object" && spec.attr;
      // If selector is empty, use the element itself (useful for "just get the list item text").
      if (!sel) {
        row[key] = $(el).text().trim();
        continue;
      }
      const node = $(el).find(sel).first();
      if (node.length) row[key] = attr ? (node.attr(attr) || "").trim() : node.text().trim();
      else row[key] = "";
    }
    result.push(row);
  }
  return result;
}

/**
 * Extract from network: intercept responses matching urlPattern, return JSON (or jsonPath). Call before page.goto().
 */
export async function extractFromNetwork(page, config) {
  const { urlPattern, jsonPath, timeout = 15000 } = config;
  const pattern =
    typeof urlPattern === "string"
      ? (url) => url.includes(urlPattern)
      : (url) => urlPattern.test(url);
  return new Promise((resolve) => {
    const results = [];
    const onResponse = async (response) => {
      if (!pattern(response.url())) return;
      try {
        const body = await response.json().catch(() => null);
        if (body == null) return;
        const value = jsonPath ? getByPath(body, jsonPath) : body;
        if (value !== undefined) results.push(value);
      } catch (_) { }
    };
    page.on("response", onResponse);
    const t = setTimeout(() => {
      page.off("response", onResponse);
      if (results.length === 1) resolve(results[0]);
      else if (results.length > 1) resolve(results);
      else resolve(null);
    }, timeout);
  });
}

/** Wait for first response matching urlPattern; return JSON or jsonPath. Call before page.goto(). */
export async function waitForApiResponse(page, config) {
  const { urlPattern, jsonPath, timeout = 15000 } = config;
  const pattern =
    typeof urlPattern === "string"
      ? (url) => url.includes(urlPattern)
      : (url) => urlPattern.test(url);
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      page.off("response", onResponse);
      resolve(value);
    };
    const onResponse = async (response) => {
      if (!pattern(response.url())) return;
      try {
        const body = await response.json().catch(() => null);
        if (body == null) return;
        const value = jsonPath ? getByPath(body, jsonPath) : body;
        if (value !== undefined) done(value);
      } catch (_) { }
    };
    page.on("response", onResponse);
    setTimeout(() => done(null), timeout);
  });
}

const APP_DIR = process.env.THREADLINE_APP_DIR || join(homedir(), ".threadline");
const SESSIONS_FILE = join(APP_DIR, "sessions.json");
const PROFILES_DIR = join(APP_DIR, "profiles");

function ensureAppDir() {
  if (!existsSync(APP_DIR)) mkdirSync(APP_DIR, { recursive: true });
  if (!existsSync(PROFILES_DIR)) mkdirSync(PROFILES_DIR, { recursive: true });
}

/**
 * Fetch the full HTML for a page using an optional persistent session profile.
 * This is used for selector repair: AI needs real DOM markup to propose selectors.
 *
 * @param {string} url
 * @param {{ session?: string }} opts
 */
export async function fetchPageHtml(url, opts = {}) {
  const session = opts.session;
  if (!session) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": DEFAULT_HEADERS["User-Agent"],
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    return res.text();
  }

  ensureAppDir();
  const profilePath = join(PROFILES_DIR, session);
  if (!existsSync(profilePath)) return fetchPageHtml(url, { session: undefined });
  const headless = process.env.SCRAPER_HEADLESS !== "false";
  const chromium = await getChromium();
  const browser = await launchPersistentContextWithFallback(chromium, profilePath, { headless });
  try {
    const page = browser.pages()[0] || (await browser.newPage());
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    return await page.content();
  } finally {
    await browser.close();
  }
}

/**
 * Simple fetch + cheerio scrape. For strategy "dom" + options.dom returns { extracted }.
 */
export async function scrapeUrl(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": options.userAgent || DEFAULT_HEADERS["User-Agent"],
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const html = await res.text();
  if (options.strategy === "dom" && options.dom) {
    const extracted = extractFromDom(html, options.dom);
    return { title: "", links: [], text: "", extracted, strategy: "dom" };
  }
  
  const selectors = options.selector ? [options.selector] : [];
  const parsed = parseHtmlForAi(html, url, selectors);
  
  let selectorText;
  if (options.selector && parsed.extractedComponents && parsed.extractedComponents[options.selector]) {
    selectorText = parsed.extractedComponents[options.selector][0]?.text;
  }

  return {
    title: parsed.title,
    links: parsed.links,
    text: parsed.textContent.slice(0, 5000), // Enforce upper limit to respect context size limits
    selectorText,
    extractedComponents: parsed.extractedComponents
  };
}

/** List saved session names (sessions.json + profiles dir). */
export function getSessions() {
  ensureAppDir();
  const list = new Set();
  if (existsSync(SESSIONS_FILE)) {
    try {
      const data = JSON.parse(readFileSync(SESSIONS_FILE, "utf8"));
      if (Array.isArray(data.sessions)) data.sessions.forEach((s) => list.add(s));
    } catch (_) { }
  }
  if (existsSync(PROFILES_DIR)) {
    readdirSync(PROFILES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .forEach((d) => list.add(d.name));
  }
  return Array.from(list);
}

function saveSessionName(name) {
  ensureAppDir();
  const sessions = getSessions();
  if (sessions.includes(name)) return;
  sessions.push(name);
  writeFileSync(SESSIONS_FILE, JSON.stringify({ sessions }, null, 2));
}

/** Interactive login: open browser, user logs in, storage saved under session name. */
export async function runInteractiveScrape(url, sessionName) {
  ensureAppDir();
  const profilePath = join(PROFILES_DIR, sessionName);
  mkdirSync(profilePath, { recursive: true });
  const chromium = await getChromium();
  const browser = await launchPersistentContextWithFallback(chromium, profilePath, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    userAgent: DEFAULT_HEADERS["User-Agent"],
  });
  try {
    const page = browser.pages()[0] || (await browser.newPage());
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    saveSessionName(sessionName);
    // Wait until the user closes the window/context.
    // This avoids fixed timeouts and lets the UI return immediately.
    await browser.waitForEvent("close");
  } finally {
    try {
      await browser.close();
    } catch (_) { }
  }
}

/**
 * Scrape URL with saved session (cookies). Supports strategy "dom" | "network" | "hybrid" + dom/network config.
 */
export async function scrapeWithSession(url, options = {}) {
  if (!options.session) return scrapeUrl(url, { selector: options.selector });
  const profilePath = join(PROFILES_DIR, options.session);
  if (!existsSync(profilePath)) return scrapeUrl(url, { selector: options.selector });
  const headless = process.env.SCRAPER_HEADLESS !== "false";
  const chromium = await getChromium();
  const browser = await launchPersistentContextWithFallback(chromium, profilePath, { headless });
  let html;
  try {
    const page = browser.pages()[0] || (await browser.newPage());
    const { strategy, dom, network } = options;
    if (strategy === "network" && network) {
      const p = waitForApiResponse(page, { ...network, timeout: network.timeout || 20000 });
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      const apiData = await p;
      await browser.close();
      return { title: "", links: [], text: "", extracted: apiData, strategy: "network" };
    }
    if (strategy === "dom" && dom) {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      html = await page.content();
      await browser.close();
      const extracted = extractFromDom(html, dom);
      return { title: "", links: [], text: "", extracted, strategy: "dom" };
    }
    if (strategy === "hybrid" && (dom || network)) {
      let extracted = null;
      if (network) {
        const p = waitForApiResponse(page, { ...network, timeout: network.timeout || 8000 });
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
        extracted = await p;
      }
      if (extracted == null && dom) {
        if (!html) await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
        html = await page.content();
        extracted = extractFromDom(html, dom);
      }
      await browser.close();
      return { title: "", links: [], text: "", extracted: extracted ?? [], strategy: "hybrid" };
    }
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    html = await page.content();
  } finally {
    await browser.close();
  }
  const selectors = options.selector ? [options.selector] : [];
  const parsed = parseHtmlForAi(html, url, selectors);
  
  let selectorText;
  if (options.selector && parsed.extractedComponents && parsed.extractedComponents[options.selector]) {
    selectorText = parsed.extractedComponents[options.selector][0]?.text;
  }

  return {
    title: parsed.title,
    links: parsed.links,
    text: parsed.textContent.slice(0, 5000), // Limit for AI sizing
    selectorText,
    extractedComponents: parsed.extractedComponents
  };
}
