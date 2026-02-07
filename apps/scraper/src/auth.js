import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = path.join(path.dirname(__dirname), '.sessions');

const PLATFORMS = {
  twitter: {
    id: 'twitter',
    name: 'Twitter / X',
    loginUrl: 'https://twitter.com/i/flow/login',
    successUrlPattern: /(?:twitter|x)\.com\/(?:home|[^/]+\/status|compose)/,
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    loginUrl: 'https://www.instagram.com/accounts/login/',
    successUrlPattern: /instagram\.com\/(?!accounts\/login|challenge)/,
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    loginUrl: 'https://www.linkedin.com/login',
    successUrlPattern: /linkedin\.com\/(?:feed|mynetwork|in\/)/,
  },
};

function ensureSessionsDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

export function getSessionsDir() {
  return SESSIONS_DIR;
}

export function getPlatforms() {
  return Object.values(PLATFORMS);
}

export function getSessionPath(platformId) {
  if (!PLATFORMS[platformId]) return null;
  ensureSessionsDir();
  return path.join(SESSIONS_DIR, `${platformId}.json`);
}

export function hasStoredSession(platformId) {
  const p = getSessionPath(platformId);
  return p && fs.existsSync(p);
}

export function getSessionsStatus() {
  return getPlatforms().map((p) => ({
    id: p.id,
    name: p.name,
    loggedIn: hasStoredSession(p.id),
  }));
}

export function deleteSession(platformId) {
  const p = getSessionPath(platformId);
  if (p && fs.existsSync(p)) {
    fs.unlinkSync(p);
    return true;
  }
  return false;
}

const AUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function startPlatformLogin(platformId) {
  const platform = PLATFORMS[platformId];
  if (!platform) throw new Error(`Unknown platform: ${platformId}`);

  const browser = await chromium.launch({
    headless: false,
    channel: undefined,
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();

    await page.goto(platform.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const start = Date.now();
    while (Date.now() - start < AUTH_TIMEOUT_MS) {
      const url = page.url();
      if (platform.successUrlPattern.test(url)) {
        ensureSessionsDir();
        const sessionPath = path.join(SESSIONS_DIR, `${platformId}.json`);
        await context.storageState({ path: sessionPath });
        await browser.close();
        return { ok: true, message: 'Session saved.' };
      }
      await new Promise((r) => setTimeout(r, 1500));
    }

    await browser.close();
    return { ok: false, message: 'Login timed out. Try again.' };
  } catch (err) {
    try {
      await browser.close();
    } catch (_) {}
    throw err;
  }
}
