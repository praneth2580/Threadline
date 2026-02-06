import { app } from "electron"
import { chromium, type Browser, type Page } from "playwright"
import fs from "fs"
import path from "path"
import { log } from "./logger"
import { type SocialAdapter } from "./adapters/social-adapter"

let browser: Browser | null = null

/**
 * Whether to run the scraper browser headless.
 * - Production (packaged) app: headless
 * - Dev (npm run dev): headed so you can see the browser
 * - Override with env SCRAPE_HEADLESS=true|false
 */
export function isScrapeHeadless(): boolean {
  const env = process.env.SCRAPE_HEADLESS
  if (env === "true" || env === "1") return true
  if (env === "false" || env === "0") return false
  return app.isPackaged
}

export interface ScrapeOptions {
  /** URL to load */
  url: string
  /** Wait for this selector before continuing (CSS or XPath if starting with //) */
  waitForSelector?: string
  /** Max time to wait for navigation (ms) */
  timeout?: number
  /** Extra time to wait after load (ms), useful for JS-rendered content */
  waitForTimeout?: number
  /**
   * JavaScript function body to run in the page context. Must return a JSON-serializable value.
   * Example: "return { title: document.title, links: [...document.querySelectorAll('a')].map(a => a.href) };"
   */
  script?: string
  /** Return the full HTML of the document (after any wait) */
  returnHtml?: boolean
  /** Optional request headers */
  headers?: Record<string, string>
  /** Optional user agent */
  userAgent?: string
  /** Session name to load/save cookies (e.g., "twitter") */
  session?: string
  /** If true, opens a visible browser and waits for user to close it. Saves session if session name provided. */
  interactive?: boolean
}

export interface ScrapeResult {
  ok: boolean
  html?: string
  data?: unknown
  error?: string
}

async function getBrowser(forceHeaded = false): Promise<Browser> {
  // If we need forced headed (interactive) and current is headless, close it
  if (browser && browser.isConnected() && forceHeaded && isScrapeHeadless()) {
    log("scraper", "getBrowser: switching to headed for interactive mode")
    await browser.close()
    browser = null
  }

  if (browser && browser.isConnected()) {
    log("scraper", "getBrowser: reusing existing browser")
    return browser
  }

  const headless = forceHeaded ? false : isScrapeHeadless()
  log("scraper", "getBrowser: launching headless =", headless)

  const args = process.platform === "linux"
    ? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    : headless ? ["--no-sandbox", "--disable-setuid-sandbox"] : []

  browser = await chromium.launch({
    headless,
    args,
  })
  log("scraper", "getBrowser: launched")
  return browser
}

/**
 * Scrape a URL with optional wait conditions and a custom extraction script.
 * Adaptable to any site: use waitForSelector for dynamic content and script to extract whatever you need.
 */
export async function scrape(options: ScrapeOptions): Promise<ScrapeResult> {
  const {
    url,
    waitForSelector,
    timeout = 30000,
    waitForTimeout = 0,
    script,
    returnHtml = false,
    headers,
    userAgent,
    session,
    interactive = false
  } = options

  log("scraper", "scrape: url =", url, "interactive =", interactive, "session =", session)
  let page: Page | null = null

  try {
    const b = await getBrowser(interactive)

    // Load session state
    let storageState: string | undefined
    const sessionDir = path.join(app.getPath("userData"), "sessions")
    const sessionPath = session ? path.join(sessionDir, `${session}.json`) : undefined

    if (sessionPath && fs.existsSync(sessionPath)) {
      try {
        // Read as file path string for Playwright, or object?
        // Playwright context accepts 'storageState' as path string or object.
        // Let's pass the object to handle errors better.
        const content = fs.readFileSync(sessionPath, "utf-8")
        JSON.parse(content) // Validate JSON
        storageState = sessionPath // Playwright accepts file path
        log("scraper", "scrape: using session", sessionPath)
      } catch (e) {
        log("scraper", "scrape: invalid session file", e)
      }
    }

    log("scraper", "scrape: newContext")
    const context = await b.newContext({
      userAgent: userAgent ?? undefined,
      extraHTTPHeaders: headers ?? undefined,
      ignoreHTTPSErrors: true,
      storageState: storageState as never // Type assert to avoid complex Record<...> mismatch if any
    })

    page = await context.newPage()
    log("scraper", "scrape: goto", url)

    // Interactive: No timeout, let user do their thing
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: interactive ? 0 : timeout,
    })
    log("scraper", "scrape: loaded")

    if (interactive) {
      log("scraper", "scrape: waiting for interactive session to close...")
      // Wait for page close
      await page.waitForEvent("close")
      log("scraper", "scrape: interactive session closed")

      // Save session
      if (session && sessionPath) {
        const state = await context.storageState()
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true })
        fs.writeFileSync(sessionPath, JSON.stringify(state, null, 2))
        log("scraper", "scrape: saved session to", sessionPath)
      }

      await context.close()
      return { ok: true }
    }

    if (waitForSelector) {
      const isXPath = waitForSelector.startsWith("//") || waitForSelector.startsWith("(")
      await (isXPath ? page.waitForSelector(`xpath=${waitForSelector}`, { timeout }) : page.waitForSelector(waitForSelector, { timeout }))
    }

    if (waitForTimeout > 0) {
      await page.waitForTimeout(waitForTimeout)
    }

    const result: ScrapeResult = { ok: true }

    if (returnHtml) {
      result.html = await page.content()
    }

    if (script) {
      try {
        const value = await page.evaluate(
          (fnBody: string) => new Function(fnBody)(),
          script.trim().startsWith("return") ? script : `return (${script});`
        )
        result.data = value
      } catch (e) {
        result.ok = false
        result.error = e instanceof Error ? e.message : "Script evaluation failed"
        return result
      }
    }

    await context.close()
    log("scraper", "scrape: success")
    return result
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    log("scraper", "scrape: error", err)
    return {
      ok: false,
      error: err,
    }
  } finally {
    if (page && !page.isClosed()) {
      try {
        await page.context().close()
      } catch {
        // ignore
      }
    }
  }
}

/** Close the browser instance. Call on app quit. */
export async function closeScraper(): Promise<void> {
  if (browser) {
    log("scraper", "closeScraper")
    await browser.close()
    browser = null
    log("scraper", "closeScraper: done")
  }
}

export interface SiteAdapterConfig {
  waitForSelector?: string
  waitForTimeout?: number
  timeout?: number
  script?: string
  headers?: Record<string, string>
  userAgent?: string
}

export function withSiteAdapter(
  config: SiteAdapterConfig,
  url: string,
  overrides?: Partial<ScrapeOptions>
): ScrapeOptions {
  return {
    url,
    waitForSelector: config.waitForSelector,
    waitForTimeout: config.waitForTimeout,
    timeout: config.timeout,
    script: config.script,
    headers: config.headers,
    userAgent: config.userAgent,
    ...overrides,
  }
}

export async function getSessions(): Promise<string[]> {
  const sessionDir = path.join(app.getPath("userData"), "sessions")
  if (!fs.existsSync(sessionDir)) return []
  try {
    const files = fs.readdirSync(sessionDir)
    return files.filter(f => f.endsWith(".json")).map(f => f.replace(".json", ""))
  } catch (e) {
    log("scraper", "getSessions: error", e)
    return []
  }
}

export async function getAdapters(): Promise<SocialAdapter[]> {
  const adapterDir = path.join(app.getPath("userData"), "adapters")
  if (!fs.existsSync(adapterDir)) return []
  try {
    const files = fs.readdirSync(adapterDir)
    const adapters: SocialAdapter[] = []
    for (const file of files) {
      if (file.endsWith(".json")) {
        try {
          const content = fs.readFileSync(path.join(adapterDir, file), "utf-8")
          adapters.push(JSON.parse(content))
        } catch (e) {
          log("scraper", "getAdapters: failed to parse", file, e)
        }
      }
    }
    return adapters
  } catch (e) {
    log("scraper", "getAdapters: error", e)
    return []
  }
}

export async function saveAdapter(adapter: SocialAdapter): Promise<void> {
  const adapterDir = path.join(app.getPath("userData"), "adapters")
  if (!fs.existsSync(adapterDir)) fs.mkdirSync(adapterDir, { recursive: true })
  const filePath = path.join(adapterDir, `${adapter.platform}.json`)
  fs.writeFileSync(filePath, JSON.stringify(adapter, null, 2))
  log("scraper", "saveAdapter: saved", filePath)
}
