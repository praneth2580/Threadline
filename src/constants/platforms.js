/**
 * Statically defined major social media platforms.
 * Used for session/account management, rules, and scraper config.
 *
 * id: unique key (lowercase, no spaces)
 * name: display name
 * loginUrl: typical login page URL for the platform
 */

export const SOCIAL_PLATFORMS = [
  { id: "twitter", name: "Twitter / X", loginUrl: "https://x.com/i/flow/login" },
  { id: "instagram", name: "Instagram", loginUrl: "https://www.instagram.com/accounts/login/" },
  { id: "facebook", name: "Facebook", loginUrl: "https://www.facebook.com/login" },
  { id: "linkedin", name: "LinkedIn", loginUrl: "https://www.linkedin.com/login" },
  { id: "tiktok", name: "TikTok", loginUrl: "https://www.tiktok.com/login" },
  { id: "youtube", name: "YouTube", loginUrl: "https://accounts.google.com/" },
  { id: "reddit", name: "Reddit", loginUrl: "https://www.reddit.com/login" },
  { id: "pinterest", name: "Pinterest", loginUrl: "https://www.pinterest.com/login/" },
  { id: "snapchat", name: "Snapchat", loginUrl: "https://accounts.snapchat.com/login" },
  { id: "discord", name: "Discord", loginUrl: "https://discord.com/login" },
  { id: "twitch", name: "Twitch", loginUrl: "https://www.twitch.tv/login" },
  { id: "tumblr", name: "Tumblr", loginUrl: "https://www.tumblr.com/login" },
  { id: "mastodon", name: "Mastodon", loginUrl: "https://joinmastodon.org/servers" },
  { id: "bluesky", name: "Bluesky", loginUrl: "https://bsky.app/login" },
  { id: "threads", name: "Threads", loginUrl: "https://www.threads.net/login" },
  { id: "quora", name: "Quora", loginUrl: "https://www.quora.com/" },
  { id: "medium", name: "Medium", loginUrl: "https://medium.com/m/signin" },
  { id: "github", name: "GitHub", loginUrl: "https://github.com/login" },
  { id: "vk", name: "VK", loginUrl: "https://vk.com/login" },
];

/** Map id -> platform for quick lookup */
export const PLATFORMS_BY_ID = Object.fromEntries(
  SOCIAL_PLATFORMS.map((p) => [p.id, p])
);

/** Platform ids only (e.g. for dropdowns) */
export const PLATFORM_IDS = SOCIAL_PLATFORMS.map((p) => p.id);
