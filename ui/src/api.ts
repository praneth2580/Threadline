/**
 * API base URL. In prod (same origin) use relative URLs. In dev, discover backend port.
 */
const PORT_START = Number(import.meta.env.VITE_API_PORT_START) || 3000;
const PORT_RANGE = 20;

let cachedBase: string | null = null;

function isJsonResponse(r: Response): boolean {
  const ct = r.headers.get("content-type") || "";
  return ct.toLowerCase().includes("application/json");
}

async function tryGetConfig(base: string): Promise<{ apiBase?: string } | null> {
  try {
    const r = await fetch(`${base}/api/config`, { method: "GET" });
    if (!r.ok) return null;
    if (!isJsonResponse(r)) return null;
    return (await r.json()) as { apiBase?: string };
  } catch {
    return null;
  }
}

/**
 * Returns the API base URL (e.g. "http://127.0.0.1:3001"). Resolves once and caches.
 * In prod (same origin) returns "" so fetch("/api/...") works. In dev, probes ports for GET /api/config.
 */
export async function getApiBase(): Promise<string> {
  if (cachedBase !== null) return cachedBase;
  const explicit = import.meta.env.VITE_API_URL;
  if (explicit && typeof explicit === "string") {
    cachedBase = explicit.replace(/\/$/, "");
    return cachedBase;
  }

  // If the UI is served by the backend (prod), same-origin /api/config will return JSON.
  const sameOriginConfig = await tryGetConfig("");
  if (sameOriginConfig) {
    cachedBase = "";
    return cachedBase;
  }

  for (let i = 0; i < PORT_RANGE; i++) {
    const port = PORT_START + i;
    const base = `http://127.0.0.1:${port}`;
    const data = await tryGetConfig(base);
    if (data) {
      cachedBase = data.apiBase ?? base;
      return cachedBase;
    }
  }
  cachedBase = `http://127.0.0.1:${PORT_START}`;
  return cachedBase;
}

export async function scrapeAuto(input: { platform: string; identifier: string; type: string }) {
  const base = await getApiBase();
  const r = await fetch(`${base}/api/scrape/auto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (data && (data.error || data.message)) || r.statusText;
    throw new Error(msg);
  }
  return data as unknown;
}
