/**
 * Basic Instagram profile scraper (public data only).
 * Uses fetch + cheerio; for logged-in data (followers list, etc.) use the main scraper with session + DOM/network strategy.
 */
import * as cheerio from "cheerio";
import {
  fetchText,
  randomDelay,
  normalizeUrl,
  headersWithRandomUA,
  withRetry,
  sleep,
} from "./main.js";
import { chromium } from "playwright";

const BASE_URL = "https://www.instagram.com";

/** Build profile URL for a username. */
export function profileUrl(username) {
  const u = (username || "").trim().replace(/^@/, "");
  return u ? normalizeUrl(`${BASE_URL}/${u}`) : "";
}

/**
 * Fetch profile page HTML. Uses random UA and optional delay to reduce block risk.
 * @param {string} username - handle without @
 * @param {{ delayBefore?: boolean }} opts
 */
export async function fetchProfileHtml(username, opts = {}) {
  const url = profileUrl(username);
  if (!url) throw new Error("Invalid username");
  if (opts.delayBefore) await randomDelay(800, 2000);
  const html = await fetchText(url, {
    headers: headersWithRandomUA({
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
    }),
    timeout: 20000,
  });
  return html;
}

/**
 * Parse public profile data from profile page HTML.
 * Relies on og: meta tags and optional JSON in script tags (structure may change with Instagram updates).
 * @param {string} html
 * @returns {{ username: string, fullName: string, bio: string, followersCount: number | null, followingCount: number | null, profilePicUrl: string, externalUrl: string, profileUrl: string }}
 */
export function parseProfileFromHtml(html) {
  const $ = cheerio.load(html);
  const out = {
    username: "",
    fullName: "",
    bio: "",
    followersCount: null,
    followingCount: null,
    profilePicUrl: "",
    externalUrl: "",
    profileUrl: "",
  };

  const ogTitle = $('meta[property="og:title"]').attr("content") || "";
  const ogDesc = $('meta[property="og:description"]').attr("content") || "";
  const ogImage = $('meta[property="og:image"]').attr("content") || "";
  const ogUrl = $('meta[property="og:url"]').attr("content") || "";

  // og:title is often "Name (@username)" or "(@username)"
  const matchUser = ogTitle.match(/@?(\w[\w.]*)/);
  if (matchUser) out.username = matchUser[1];
  const namePart = ogTitle.replace(/\s*\(@[\w.]+\)\s*$/, "").trim();
  if (namePart && namePart !== out.username) out.fullName = namePart;

  out.profilePicUrl = ogImage;
  out.profileUrl = ogUrl || (out.username ? profileUrl(out.username) : "");

  // og:description often has "X Followers, Y Following" and sometimes bio
  const followersMatch = ogDesc.match(/([\d,.\s]+)\s*Followers?/i);
  const followingMatch = ogDesc.match(/([\d,.\s]+)\s*Following/i);
  if (followersMatch) out.followersCount = parseInt(followersMatch[1].replace(/\D/g, ""), 10) || null;
  if (followingMatch) out.followingCount = parseInt(followingMatch[1].replace(/\D/g, ""), 10) || null;

  // Bio sometimes in og:description after " - " or first line
  const bioPart = ogDesc.split(/\s*[-–—]\s*/)[0]?.trim();
  if (bioPart && !/^\d[\d,.\s]*\s*(Followers?|Following)/i.test(bioPart)) {
    out.bio = bioPart.slice(0, 500);
  }

  // Fallback: try JSON in script tags (Instagram often embeds state)
  $('script[type="application/json"]').each((_, el) => {
    try {
      const text = $(el).html();
      if (!text || out.followersCount != null) return;
      const data = JSON.parse(text);
      const user = data?.entry_data?.ProfilePage?.[0]?.graphql?.user
        || data?.required?.__additionalDataLoaded__?.__relay_internal__?.__r?.graphql?.user
        || data?.xdt_api__v1__feed__user_timeline_graphql_connection?.data?.user;
      if (user) {
        if (!out.username) out.username = user.username || "";
        if (!out.fullName) out.fullName = user.full_name || "";
        if (!out.bio) out.bio = (user.biography || "").slice(0, 500);
        if (out.followersCount == null) out.followersCount = user.edge_followed_by?.count ?? null;
        if (out.followingCount == null) out.followingCount = user.edge_follow?.count ?? null;
        if (!out.profilePicUrl) out.profilePicUrl = user.profile_pic_url_hd || user.profile_pic_url || "";
        if (!out.externalUrl && user.external_url) out.externalUrl = user.external_url;
      }
    } catch (_) { }
  });

  return out;
}

/**
 * Scrape Instagram profile using an existing Playwright page.
 * @param {import('playwright').Page} page
 * @param {string} username
 */
export async function scrapeProfileWithPage(page, username) {
  const u = (username || "").trim().replace(/^@/, "");
  const url = profileUrl(u);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

  // Wait a bit for JS to settle
  await sleep(1500);

  const html = await page.content();
  const profile = parseProfileFromHtml(html);

  // Fallback/Enhancement: Try to get data directly from page state if parsing failed some fields
  if (!profile.followersCount || !profile.bio) {
    const extra = await page.evaluate(() => {
      try {
        const title = document.title || "";
        const desc = document.querySelector('meta[name="description"]')?.content || "";
        return { title, desc };
      } catch { return {}; }
    });
    // Can add more specific DOM selectors here if needed
  }

  if (!profile.username) profile.username = u;
  if (!profile.profileUrl) profile.profileUrl = url;

  return profile;
}

/**
 * Scrape a public Instagram profile by username using a browser.
 * @param {string} username - handle with or without @
 * @param {{ delayBefore?: boolean, page?: import('playwright').Page }} opts
 */
export async function scrapeProfile(username, opts = {}) {
  const u = (username || "").trim().replace(/^@/, "");
  if (!u) throw new Error("Username required");

  if (opts.page) {
    return scrapeProfileWithPage(opts.page, u);
  }

  const headless = process.env.SCRAPER_HEADLESS !== "false";
  const browser = await chromium.launch({ headless });
  try {
    const page = await browser.newPage();
    const profile = await scrapeProfileWithPage(page, u);
    console.log("profile: ", profile);
    return profile;
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Followers / following (require Playwright page + logged-in session)
// ---------------------------------------------------------------------------

/**
 * Extract user edges from Instagram GraphQL response body (structure varies by version).
 * @param {unknown} body - Parsed JSON response
 * @param {'followers' | 'following'} kind
 * @returns {{ edges: Array<{ node: { id: string, username: string, full_name?: string, profile_pic_url?: string } }>, page_info?: { has_next_page: boolean, end_cursor?: string } } | null}
 */
function getEdgesFromGraphQLBody(body, kind) {
  const key = kind === "followers" ? "edge_followed_by" : "edge_follow";
  if (!body || typeof body !== "object") return null;
  const b = body;
  // Possible paths: data.data.user.edge_followed_by, data.xdt_api__..., etc.
  const candidates = [
    b?.data?.user?.[key],
    b?.data?.data?.user?.[key],
    Object.values(b?.data?.data || {}).find((v) => v?.user?.[key])?.user?.[key],
    Object.values(b?.data || {}).find((v) => v?.user?.[key])?.user?.[key],
  ];
  for (const edge of candidates) {
    if (edge?.edges && Array.isArray(edge.edges)) {
      return {
        edges: edge.edges,
        page_info: edge.page_info,
      };
    }
  }
  return null;
}

/**
 * Normalize GraphQL edge node to { id, username, fullName, profilePicUrl }.
 */
function nodeToUser(node) {
  if (!node) return null;
  return {
    id: node.id || "",
    username: node.username || "",
    fullName: node.full_name || node.full_name || "",
    profilePicUrl: node.profile_pic_url || node.profile_pic_url_hd || "",
  };
}

/**
 * Open the followers modal on profile page (must be logged in). Waits for link and clicks.
 * @param {import('playwright').Page} page
 * @param {string} username - profile owner
 * @param {{ timeout?: number }} opts
 */
export async function openFollowersModal(page, username, opts = {}) {
  const u = (username || "").trim().replace(/^@/, "");
  if (!u) throw new Error("Username required");
  const url = profileUrl(u);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: opts.timeout || 20000 });
  await randomDelay(500, 1200);
  const link = page.locator('a[href*="/followers/"]').first();
  await link.waitFor({ state: "visible", timeout: opts.timeout || 10000 });
  await link.click();
  await sleep(800);
}

/**
 * Open the following modal on profile page (must be logged in).
 */
export async function openFollowingModal(page, username, opts = {}) {
  const u = (username || "").trim().replace(/^@/, "");
  if (!u) throw new Error("Username required");
  const url = profileUrl(u);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: opts.timeout || 20000 });
  await randomDelay(500, 1200);
  const link = page.locator('a[href*="/following/"]').first();
  await link.waitFor({ state: "visible", timeout: opts.timeout || 10000 });
  await link.click();
  await sleep(800);
}

/**
 * Scrape followers list. Requires a Playwright page with logged-in Instagram session.
 * Tries to capture GraphQL response when modal opens; fallback scrapes usernames from modal DOM.
 * @param {import('playwright').Page} page
 * @param {string} username - profile owner
 * @param {{ limit?: number, timeout?: number, useDomFallback?: boolean }} opts
 * @returns {Promise<{ users: Array<{ id: string, username: string, fullName: string, profilePicUrl: string }>, nextCursor?: string }>}
 */
export async function scrapeFollowersWithPage(page, username, opts = {}) {
  const { limit = 100, timeout = 20000, useDomFallback = true } = opts;
  const users = [];
  let nextCursor;
  const kind = "followers";

  const collected = await new Promise((resolve) => {
    const results = [];
    const onResponse = async (response) => {
      const u = response.url();
      if (!u.includes("graphql")) return;
      try {
        const body = await response.json().catch(() => null);
        const data = getEdgesFromGraphQLBody(body, kind);
        if (data?.edges?.length) {
          results.push(data);
        }
      } catch (_) { }
    };
    page.on("response", onResponse);
    openFollowersModal(page, username, { timeout })
      .then(() => sleep(2000))
      .then(() => {
        page.off("response", onResponse);
        resolve(results);
      })
      .catch((err) => {
        page.off("response", onResponse);
        resolve([]);
      });
  });

  if (collected.length > 0) {
    const last = collected[collected.length - 1];
    const edges = last.edges || [];
    nextCursor = last.page_info?.end_cursor;
    for (const e of edges.slice(0, limit)) {
      const u = nodeToUser(e?.node);
      if (u) users.push(u);
    }
  }

  if (users.length === 0 && useDomFallback) {
    const list = page.locator('div[role="dialog"] a[href^="/"]');
    const count = await list.count();
    const seen = new Set();
    for (let i = 0; i < Math.min(count, limit); i++) {
      const href = await list.nth(i).getAttribute("href");
      const uname = href?.replace(/^\//, "").split("/")[0].trim();
      if (uname && !seen.has(uname)) {
        seen.add(uname);
        users.push({ id: "", username: uname, fullName: "", profilePicUrl: "" });
      }
    }
  }

  return { users, nextCursor };
}

/**
 * Scrape following list. Requires a Playwright page with logged-in Instagram session.
 * @param {import('playwright').Page} page
 * @param {string} username - profile owner
 * @param {{ limit?: number, timeout?: number, useDomFallback?: boolean }} opts
 */
export async function scrapeFollowingWithPage(page, username, opts = {}) {
  const { limit = 100, timeout = 20000, useDomFallback = true } = opts;
  const users = [];
  let nextCursor;
  const kind = "following";

  const collected = await new Promise((resolve) => {
    const results = [];
    const onResponse = async (response) => {
      if (!response.url().includes("graphql")) return;
      try {
        const body = await response.json().catch(() => null);
        const data = getEdgesFromGraphQLBody(body, kind);
        if (data?.edges?.length) results.push(data);
      } catch (_) { }
    };
    page.on("response", onResponse);
    openFollowingModal(page, username, { timeout })
      .then(() => sleep(2000))
      .then(() => {
        page.off("response", onResponse);
        resolve(results);
      })
      .catch(() => {
        page.off("response", onResponse);
        resolve([]);
      });
  });

  if (collected.length > 0) {
    const last = collected[collected.length - 1];
    const edges = last.edges || [];
    nextCursor = last.page_info?.end_cursor;
    for (const e of edges.slice(0, limit)) {
      const u = nodeToUser(e?.node);
      if (u) users.push(u);
    }
  }

  if (users.length === 0 && useDomFallback) {
    const list = page.locator('div[role="dialog"] a[href^="/"]');
    const count = await list.count();
    const seen = new Set();
    for (let i = 0; i < Math.min(count, limit); i++) {
      const href = await list.nth(i).getAttribute("href");
      const uname = href?.replace(/^\//, "").split("/")[0].trim();
      if (uname && !seen.has(uname)) {
        seen.add(uname);
        users.push({ id: "", username: uname, fullName: "", profilePicUrl: "" });
      }
    }
  }

  return { users, nextCursor };
}

