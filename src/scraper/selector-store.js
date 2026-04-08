/**
 * selector-store.js
 *
 * Persistent selector overrides that can be updated at runtime (self-healing scrape).
 *
 * Stored under THREADLINE_APP_DIR (defaults to ~/.threadline) so it survives restarts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const APP_DIR = process.env.THREADLINE_APP_DIR || join(homedir(), ".threadline");
const SELECTORS_FILE = join(APP_DIR, "selectors.json");

function ensureAppDir() {
  if (!existsSync(APP_DIR)) mkdirSync(APP_DIR, { recursive: true });
}

function readStore() {
  ensureAppDir();
  if (!existsSync(SELECTORS_FILE)) return { version: 1, selectors: {} };
  try {
    const raw = readFileSync(SELECTORS_FILE, "utf8");
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return { version: 1, selectors: {} };
    if (!data.selectors || typeof data.selectors !== "object") return { version: 1, selectors: {} };
    return data;
  } catch {
    return { version: 1, selectors: {} };
  }
}

function writeStore(store) {
  ensureAppDir();
  writeFileSync(SELECTORS_FILE, JSON.stringify(store, null, 2));
}

/**
 * Get selector overrides for a given platform+type.
 * @param {string} platformId
 * @param {string} type
 * @returns {{ listSelector?: string } | null}
 */
export function getSelectorOverride(platformId, type) {
  const store = readStore();
  const p = store.selectors?.[platformId];
  const t = p?.[type];
  if (!t || typeof t !== "object") return null;
  const listSelector = typeof t.listSelector === "string" ? t.listSelector : undefined;
  if (!listSelector) return null;
  return { listSelector };
}

/**
 * Persist a selector override.
 * @param {string} platformId
 * @param {string} type
 * @param {{ listSelector: string }} value
 */
export function setSelectorOverride(platformId, type, value) {
  const store = readStore();
  store.version = 1;
  store.selectors = store.selectors || {};
  store.selectors[platformId] = store.selectors[platformId] || {};
  store.selectors[platformId][type] = {
    ...(store.selectors[platformId][type] || {}),
    listSelector: value.listSelector,
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
}

