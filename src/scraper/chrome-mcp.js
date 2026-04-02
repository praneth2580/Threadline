/**
 * chrome-mcp.js
 *
 * Chrome MCP layer: connects Playwright to an already-running Chrome/Chromium
 * instance via the Chrome DevTools Protocol (CDP) remote-debugging port.
 *
 * How to start Chrome with remote debugging:
 *   google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-mcp
 *   # or headless:
 *   google-chrome --remote-debugging-port=9222 --headless=new --user-data-dir=/tmp/chrome-mcp
 *
 * Set CHROME_CDP_URL in .env (defaults to http://localhost:9222).
 * If Chrome is not reachable, falls back to launching a fresh Chromium process.
 */

import { chromium } from "playwright";

const CDP_URL = process.env.CHROME_CDP_URL || "http://localhost:9222";

/**
 * Get a Playwright Browser connected to a running Chrome via CDP.
 * Falls back to launching a new Chromium if the CDP endpoint is unavailable.
 *
 * @returns {Promise<{ browser: import('playwright').Browser, isMcp: boolean }>}
 *   isMcp=true  → browser is a shared remote instance; only close the page, NOT the browser.
 *   isMcp=false → browser is a locally launched process; close it when done.
 */
export async function getChromeMcpBrowser() {
  try {
    // connectOverCDP attaches to an existing Chrome/Edge process.
    const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
    console.log(`[chrome-mcp] Connected to Chrome at ${CDP_URL}`);
    return { browser, isMcp: true };
  } catch (err) {
    console.warn(
      `[chrome-mcp] Could not connect to ${CDP_URL} (${err.message}). Falling back to local Chromium.`
    );
    const headless = process.env.SCRAPER_HEADLESS !== "false";
    const browser = await chromium.launch({ headless });
    return { browser, isMcp: false };
  }
}

/**
 * Get a fresh page from a Chrome MCP browser connection.
 * Re-uses the first existing browser context if available (avoids creating
 * extra profiles when attached to a user's Chrome).
 *
 * @param {import('playwright').Browser} browser
 * @returns {Promise<import('playwright').Page>}
 */
export async function getMcpPage(browser) {
  const contexts = browser.contexts();
  const ctx = contexts.length > 0 ? contexts[0] : await browser.newContext();
  return ctx.newPage();
}

/**
 * Safely close a page (and optionally the browser if it was locally launched).
 *
 * @param {import('playwright').Page} page
 * @param {import('playwright').Browser} browser
 * @param {boolean} isMcp - If true, only closes the page; the browser stays open.
 */
export async function closeMcpPage(page, browser, isMcp) {
  try {
    await page.close();
  } catch (_) {}
  if (!isMcp) {
    try {
      await browser.close();
    } catch (_) {}
  }
}

/**
 * Check if the Chrome CDP endpoint is reachable.
 * Returns true if Chrome is running with --remote-debugging-port.
 */
export async function isChromeReachable() {
  try {
    const res = await fetch(`${CDP_URL}/json/version`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
