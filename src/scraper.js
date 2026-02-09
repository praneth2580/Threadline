import * as cheerio from "cheerio";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { chromium } from "playwright";

const APP_DIR = process.env.THREADLINE_APP_DIR || join(homedir(), ".threadline");
const SESSIONS_FILE = join(APP_DIR, "sessions.json");
const PROFILES_DIR = join(APP_DIR, "profiles");

function ensureAppDir() {
  if (!existsSync(APP_DIR)) mkdirSync(APP_DIR, { recursive: true });
  if (!existsSync(PROFILES_DIR)) mkdirSync(PROFILES_DIR, { recursive: true });
}

/**
 * Simple fetch + cheerio scrape. Good for static HTML.
 * @param {string} url
 * @param {{ selector?: string, userAgent?: string }} options
 * @returns {{ title: string, links: { href: string, text: string }[], text: string, selectorText?: string }}
 */
export async function scrapeUrl(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": options.userAgent || "Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const title = $("title").text().trim() || "";
  const links = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const text = $(el).text().trim();
    if (href) links.push({ href, text });
  });
  let selectorText;
  if (options.selector) {
    const el = $(options.selector).first();
    selectorText = el.text().trim() || undefined;
  }
  return {
    title,
    links,
    text: $("body").text().replace(/\s+/g, " ").trim().slice(0, 5000),
    selectorText,
  };
}

/**
 * List saved session names (from sessions.json and profiles dir).
 */
export function getSessions() {
  ensureAppDir();
  const list = new Set();
  if (existsSync(SESSIONS_FILE)) {
    try {
      const data = JSON.parse(readFileSync(SESSIONS_FILE, "utf8"));
      if (Array.isArray(data.sessions)) data.sessions.forEach((s) => list.add(s));
    } catch (_) {}
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

/**
 * Interactive login: open browser, go to url, user logs in, then we save storage state under session name.
 * @param {string} url
 * @param {string} sessionName
 */
export async function runInteractiveScrape(url, sessionName) {
  ensureAppDir();
  const profilePath = join(PROFILES_DIR, sessionName);
  mkdirSync(profilePath, { recursive: true });
  const browser = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0",
  });
  try {
    const page = browser.pages()[0] || (await browser.newPage());
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    saveSessionName(sessionName);
    await page.waitForTimeout(10 * 60 * 1000);
  } finally {
    await browser.close();
  }
}

/**
 * Scrape a URL using a saved session (cookies/storage from a previous interactive login).
 * @param {string} url
 * @param {{ session?: string, selector?: string }} options
 */
export async function scrapeWithSession(url, options = {}) {
  if (!options.session) return scrapeUrl(url, { selector: options.selector });
  const profilePath = join(PROFILES_DIR, options.session);
  if (!existsSync(profilePath)) return scrapeUrl(url, { selector: options.selector });
  const browser = await chromium.launchPersistentContext(profilePath, { headless: true });
  let html;
  try {
    const page = browser.pages()[0] || (await browser.newPage());
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    html = await page.content();
  } finally {
    await browser.close();
  }
  const $ = cheerio.load(html);
  const title = $("title").text().trim() || "";
  const links = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const text = $(el).text().trim();
    if (href) links.push({ href, text });
  });
  let selectorText;
  if (options.selector) {
    const el = $(options.selector).first();
    selectorText = el.text().trim() || undefined;
  }
  return {
    title,
    links,
    text: $("body").text().replace(/\s+/g, " ").trim().slice(0, 5000),
    selectorText,
  };
}
