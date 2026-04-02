/**
 * Basic Instagram profile scraper (public data only).
 *
 * Enhancements over the base version:
 *   - Chrome MCP: reuses a running Chrome via CDP instead of launching a fresh Chromium each time.
 *   - Ollama: uses a local LLM as a fallback parser when cheerio/regex leaves fields empty.
 *
 * For logged-in data (followers list, etc.) use the main scraper with session + DOM/network strategy.
 */
import * as cheerio from "cheerio";
import {
  fetchText,
  randomDelay,
  normalizeUrl,
  headersWithRandomUA,
  withRetry,
  sleep,
  stripHtml,
} from "./main.js";
import { mcpNavigate, mcpEvaluate, mcpHover, mcpClick } from "./mcp-client.js";
import { ollamaExtractProfile, isOllamaAvailable, ollamaExtractList } from "./ollama.js";

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

// Cheerio parsing removed. Relying strictly on Ollama for primary extraction based on user preference.

/**
 * Scrape Instagram profile using MCP Client.
 * Uses Ollama LLM exclusively to parse structured facts from the raw page text.
 * @param {import('@modelcontextprotocol/sdk/client/index.js').Client} mcpClient
 * @param {string} username
 */
export async function scrapeProfileWithMcp(mcpClient, username) {
  const u = (username || "").trim().replace(/^@/, "");
  const url = profileUrl(u);
  
  await mcpNavigate(mcpClient, url);

  // Wait for React UI to render
  await sleep(2500);

  // Grab entire body text via evaluate
  const pageText = await mcpEvaluate(mcpClient, "document.body.innerText");

  console.log(`[ollama] Processing primary profile extraction for @${u}`);
  const ollamaReady = await isOllamaAvailable();
  if (!ollamaReady) {
    throw new Error("Ollama is not running. It is required as the primary extraction engine.");
  }

  const llmData = await ollamaExtractProfile(pageText, u);
  if (!llmData) {
    throw new Error("Ollama failed to extract valid profile JSON from the page text.");
  }

  return {
    username: llmData.username || u,
    fullName: llmData.fullName || "",
    bio: llmData.bio || "",
    followersCount: llmData.followersCount ?? null,
    followingCount: llmData.followingCount ?? null,
    profilePicUrl: "", // Need DOM parsing for images, left empty per LLM primary instruction
    externalUrl: llmData.externalUrl || "",
    profileUrl: url,
  };
}

/**
 * Scrape a public Instagram profile by username. (Must supply mcpClient in opts).
 * @param {string} username - handle with or without @
 * @param {{ mcpClient?: import('@modelcontextprotocol/sdk/client/index.js').Client }} opts
 */
export async function scrapeProfile(username, opts = {}) {
  const u = (username || "").trim().replace(/^@/, "");
  if (!u) throw new Error("Username required");

  if (!opts.mcpClient) {
    throw new Error("mcpClient is required to scrape using MCP");
  }

  const profile = await scrapeProfileWithMcp(opts.mcpClient, u);
  console.log("profile: ", profile);
  return profile;
}

// ---------------------------------------------------------------------------
// Followers / following (require Playwright page + logged-in session)
// ---------------------------------------------------------------------------

// Removed raw GraphQL parsing in favor of Ollama visual extraction

/**
 * Open the followers modal on profile page using MCP.
 * @param {import('@modelcontextprotocol/sdk/client/index.js').Client} mcpClient
 * @param {string} username - profile owner
 */
export async function openFollowersModal(mcpClient, username) {
  const u = (username || "").trim().replace(/^@/, "");
  if (!u) throw new Error("Username required");
  const url = profileUrl(u);
  await mcpNavigate(mcpClient, url);
  await sleep(2500);
  await mcpClick(mcpClient, 'a[href*="/followers/"]');
  await sleep(1500);
}

/**
 * Open the following modal on profile page using MCP.
 */
export async function openFollowingModal(mcpClient, username) {
  const u = (username || "").trim().replace(/^@/, "");
  if (!u) throw new Error("Username required");
  const url = profileUrl(u);
  await mcpNavigate(mcpClient, url);
  await sleep(2500);
  await mcpClick(mcpClient, 'a[href*="/following/"]');
  await sleep(1500);
}



/**
 * Scrape followers list using MCP Client + Ollama.
 * @param {import('@modelcontextprotocol/sdk/client/index.js').Client} mcpClient
 * @param {string} username - profile owner
 * @returns {Promise<{ users: Array<{ id: string, username: string, fullName: string, profilePicUrl: string }>, nextCursor?: string }>}
 */
export async function scrapeFollowersWithMcp(mcpClient, username) {
  await openFollowersModal(mcpClient, username);
  await sleep(1000);

  // Scroll down a few times inside the modal using JS evaluation via MCP
  for (let i = 0; i < 6; i++) {
    await mcpEvaluate(mcpClient, `
      (function() {
        var modal = document.querySelector('div[role="dialog"]');
        if (modal) modal.scrollBy({ top: 1500, behavior: 'smooth' });
      })()
    `);
    await sleep(1500);
  }

  const rawText = await mcpEvaluate(mcpClient, `
    (function() {
      var modal = document.querySelector('div[role="dialog"]');
      return modal ? modal.innerText : "";
    })()
  `) || "";
  
  console.log(`[ollama] Processing followers list for @${username}`);
  
  const llmParsed = await ollamaExtractList(rawText);
  const users = llmParsed.map(u => ({
    id: "",
    username: u.username,
    fullName: u.fullName,
    profilePicUrl: ""
  }));

  return { users, nextCursor: null };
}

/**
 * Scrape following list using MCP Client + Ollama.
 * @param {import('@modelcontextprotocol/sdk/client/index.js').Client} mcpClient
 * @param {string} username - profile owner
 */
export async function scrapeFollowingWithMcp(mcpClient, username) {
  await openFollowingModal(mcpClient, username);
  await sleep(1000);

  // Scroll down a few times inside the modal using JS evaluation via MCP
  for (let i = 0; i < 6; i++) {
    await mcpEvaluate(mcpClient, `
      (function() {
        var modal = document.querySelector('div[role="dialog"]');
        if (modal) modal.scrollBy({ top: 1500, behavior: 'smooth' });
      })()
    `);
    await sleep(1500);
  }

  const rawText = await mcpEvaluate(mcpClient, `
    (function() {
      var modal = document.querySelector('div[role="dialog"]');
      return modal ? modal.innerText : "";
    })()
  `) || "";

  console.log(`[ollama] Processing following list for @${username}`);
  
  const llmParsed = await ollamaExtractList(rawText);
  const users = llmParsed.map(u => ({
    id: "",
    username: u.username,
    fullName: u.fullName,
    profilePicUrl: ""
  }));

  return { users, nextCursor: null };
}
