/**
 * Scraping rules defined statically in code (read-only in UI).
 * Add or edit entries here to change how platforms are scraped.
 */
import { SOCIAL_PLATFORMS } from "./platforms.js";

export const SCRAPER_ADAPTERS = SOCIAL_PLATFORMS.map((p) => ({
  platform: p.name,
  baseUrl: p.loginUrl.split("/").slice(0, 3).join("/"),
  loginUrl: p.loginUrl,
  profileUrlTemplate: `https://${p.id}.com/u/{id}`,
  profileScript: "return { username: document.title }",
  connections: {
    listSelector: ".user-list li, .follow-list .item, [data-testid='list-item']",
    listScript: "return []",
  },
}));
