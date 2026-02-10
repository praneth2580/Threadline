/**
 * API base URL. In prod (same origin) use relative URLs. In dev, discover backend port.
 */
const PORT_START = Number(import.meta.env.VITE_API_PORT_START) || 3000;
const PORT_RANGE = 20;

let cachedBase: string | null = null;

/** Same origin = we're served by the backend (prod). */
function isSameOrigin(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const origin = window.location.origin;
    return origin.startsWith("http://127.0.0.1:") || origin.startsWith("http://localhost:");
  } catch {
    return false;
  }
}

/**
 * Returns the API base URL (e.g. "http://127.0.0.1:3001"). Resolves once and caches.
 * In prod (same origin) returns "" so fetch("/api/...") works. In dev, probes ports for GET /api/config.
 */
export async function getApiBase(): Promise<string> {
  if (cachedBase !== null) return cachedBase;
  if (isSameOrigin()) {
    cachedBase = "";
    return cachedBase;
  }
  const explicit = import.meta.env.VITE_API_URL;
  if (explicit && typeof explicit === "string") {
    cachedBase = explicit.replace(/\/$/, "");
    return cachedBase;
  }
  for (let i = 0; i < PORT_RANGE; i++) {
    const port = PORT_START + i;
    const base = `http://127.0.0.1:${port}`;
    try {
      const r = await fetch(`${base}/api/config`, { method: "GET" });
      if (r.ok) {
        const data = (await r.json()) as { apiBase?: string };
        cachedBase = data.apiBase ?? base;
        return cachedBase;
      }
    } catch {
      continue;
    }
  }
  cachedBase = `http://127.0.0.1:${PORT_START}`;
  return cachedBase;
}
