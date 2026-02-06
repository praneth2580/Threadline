/**
 * Debug logger for the Electron main/preload processes.
 * Logs only when THREADLINE_DEBUG is set to "1" or "true".
 * Turn off: unset the env or set THREADLINE_DEBUG=0 or false.
 * Usage: THREADLINE_DEBUG=1 npm run dev
 */
const enabled =
  process.env.THREADLINE_DEBUG === "1" ||
  process.env.THREADLINE_DEBUG === "true"

console.log(`THREADLINE_DEBUG [${enabled ? "ENABLED" : "DISABLED"}]`);

export function log(tag: string, ...args: unknown[]): void {
  if (enabled) console.log(`[${tag}]`, ...args)
}
