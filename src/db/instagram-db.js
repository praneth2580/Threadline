/**
 * Instagram scrape + DB: scrape profile (and optionally followers/following with session), upsert accounts and relations, return result for frontend.
 */
import db from "./db.js";
import * as instagram from "../scraper/instagram.js";
import { chromium } from "playwright";
import { join } from "path";
import { existsSync } from "fs";
import { homedir } from "os";

const PLATFORM = "instagram";
const APP_DIR = process.env.THREADLINE_APP_DIR || join(homedir(), ".threadline");
const PROFILES_DIR = join(APP_DIR, "profiles");

/**
 * Upsert an account; returns { id, created: boolean }.
 * @param {{ username: string, profile_url?: string }} account
 * @returns {{ id: number, created: boolean }}
 */
export function upsertAccount(account) {
  const now = Math.floor(Date.now() / 1000);
  const username = (account.username || "").trim().replace(/^@/, "");
  if (!username) throw new Error("username required");

  const existing = db.prepare("SELECT id, first_scraped_timestamp FROM accounts WHERE username = ? AND platform = ?").get(username, PLATFORM);
  const profileUrl = account.profile_url || account.profileUrl || `https://www.instagram.com/${username}/`;

  if (existing) {
    db.prepare(
      "UPDATE accounts SET profile_url = ?, last_scraped_timestamp = ? WHERE id = ?"
    ).run(profileUrl, now, existing.id);
    return { id: existing.id, created: false };
  }

  const result = db.prepare(
    `INSERT INTO accounts (username, platform, profile_url, last_scraped_timestamp, first_scraped_timestamp)
     VALUES (?, ?, ?, ?, ?)`
  ).run(username, PLATFORM, profileUrl, now, now);
  return { id: result.lastInsertRowid, created: true };
}

/**
 * Ensure account exists; return id. Creates if missing.
 * @param {string} username
 * @param {string} [profileUrl]
 * @returns {number}
 */
function ensureAccountId(username, profileUrl) {
  const u = (username || "").trim().replace(/^@/, "");
  if (!u) throw new Error("username required");
  let row = db.prepare("SELECT id FROM accounts WHERE username = ? AND platform = ?").get(u, PLATFORM);
  if (row) return row.id;
  const { id } = upsertAccount({ username: u, profile_url: profileUrl || `https://www.instagram.com/${u}/` });
  return id;
}

/**
 * Insert relation (source follows destination) if not exists.
 * @param {number} sourceAccountId
 * @param {number} destinationAccountId
 * @returns {boolean} true if inserted
 */
function insertRelation(sourceAccountId, destinationAccountId) {
  if (sourceAccountId === destinationAccountId) return false;
  try {
    db.prepare(
      `INSERT INTO relations (source_account_id, destination_account_id, last_scraped_timestamp)
       VALUES (?, ?, ?)`
    ).run(sourceAccountId, destinationAccountId, Math.floor(Date.now() / 1000));
    return true;
  } catch (e) {
    if (e.message && e.message.includes("UNIQUE")) return false;
    throw e;
  }
}

/**
 * Scrape Instagram profile (public) and optionally followers/following with session; save/update DB; return result for frontend.
 * @param {{ username: string, session?: string, includeFollowers?: boolean, includeFollowing?: boolean, limit?: number }} opts
 * @returns {Promise<{ account: { id: number, username: string, platform: string, profile_url: string }, profile: object, relationsAdded: number, followersScraped?: number, followingScraped?: number, error?: string }>}
 */
export async function scrapeInstagramAndSave(opts = {}) {
  const username = (opts.username || "").trim().replace(/^@/, "");
  if (!username) throw new Error("username is required");

  const limit = Math.min(Math.max(0, opts.limit || 50), 500);
  const now = Math.floor(Date.now() / 1000);
  let relationsAdded = 0;
  let followersScraped = 0;
  let followingScraped = 0;

  // 1) Public profile scrape
  let profile;
  try {
    profile = await instagram.scrapeProfile(username, { delayBefore: true });
  } catch (e) {
    return {
      account: null,
      profile: null,
      relationsAdded: 0,
      error: e.message || "Failed to scrape profile",
    };
  }

  const profileUrl = profile.profileUrl || `https://www.instagram.com/${profile.username || username}/`;
  const { id: mainId } = upsertAccount({
    username: profile.username || username,
    profile_url: profileUrl,
  });

  const accountRow = db.prepare("SELECT id, username, platform, profile_url FROM accounts WHERE id = ?").get(mainId);
  const account = accountRow
    ? {
      id: accountRow.id,
      username: accountRow.username,
      platform: accountRow.platform,
      profile_url: accountRow.profile_url,
    }
    : { id: mainId, username: profile.username || username, platform: PLATFORM, profile_url: profileUrl };

  const result = {
    account,
    profile: {
      username: profile.username,
      fullName: profile.fullName,
      bio: profile.bio,
      followersCount: profile.followersCount,
      followingCount: profile.followingCount,
      profilePicUrl: profile.profilePicUrl,
      profileUrl: profile.profileUrl,
    },
    relationsAdded: 0,
  };

  const session = opts.session && opts.session.trim();
  const includeFollowers = opts.includeFollowers === true;
  const includeFollowing = opts.includeFollowing === true;

  if (!session || (!includeFollowers && !includeFollowing)) {
    return result;
  }

  const profilePath = join(PROFILES_DIR, session);
  if (!existsSync(profilePath)) {
    return { ...result, error: "Session not found" };
  }

  const headless = process.env.SCRAPER_HEADLESS !== "false";
  const browser = await chromium.launchPersistentContext(profilePath, { headless });
  try {
    const page = browser.pages()[0] || (await browser.newPage());

    if (includeFollowers) {
      try {
        const { users } = await instagram.scrapeFollowersWithPage(page, username, { limit, useDomFallback: true });
        followersScraped = users.length;
        for (const u of users) {
          const uname = (u.username || "").trim().replace(/^@/, "");
          if (!uname) continue;
          const destId = ensureAccountId(uname);
          if (insertRelation(destId, mainId)) relationsAdded++;
        }
      } catch (e) {
        result.error = (result.error ? result.error + "; " : "") + "Followers: " + (e.message || "failed");
      }
    }

    if (includeFollowing) {
      try {
        const { users } = await instagram.scrapeFollowingWithPage(page, username, { limit, useDomFallback: true });
        followingScraped = users.length;
        for (const u of users) {
          const uname = (u.username || "").trim().replace(/^@/, "");
          if (!uname) continue;
          const destId = ensureAccountId(uname);
          if (insertRelation(mainId, destId)) relationsAdded++;
        }
      } catch (e) {
        result.error = (result.error ? result.error + "; " : "") + "Following: " + (e.message || "failed");
      }
    }
  } finally {
    await browser.close();
  }

  result.relationsAdded = relationsAdded;
  result.followersScraped = followersScraped;
  result.followingScraped = followingScraped;
  return result;
}

/**
 * Scrape Instagram profile (public) and optionally followers/following with session; save/update DB; return result for frontend.
 * @param {{ username: string, session?: string, includeFollowers?: boolean, includeFollowing?: boolean, limit?: number }} opts
 * @returns {Promise<{ account: { id: number, username: string, platform: string, profile_url: string }, profile: object, relationsAdded: number, followersScraped?: number, followingScraped?: number, error?: string }>}
 */
export async function fetchInstagram(username) {
  const u = (username || "").trim().replace(/^@/, "");
  if (!u) throw new Error("username required");
  let row = db.prepare("SELECT id FROM accounts WHERE username = ? AND platform = ?").get(u, PLATFORM);
  if (!row) return null;

  const connections = db.prepare(`
    SELECT r.id, r.source_account_id, r.destination_account_id, r.last_scraped_timestamp, r.created_at,
           src.username AS source_username,
           dst.username AS destination_username
    FROM relations r
    JOIN accounts src ON src.id = r.source_account_id
    JOIN accounts dst ON dst.id = r.destination_account_id
    WHERE r.source_account_id = ? OR r.destination_account_id = ?
  `).all(row.id, row.id);
  return {
    account: row,
    connections,
  };
}