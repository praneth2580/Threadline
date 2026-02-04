import { app } from "electron"
import { chromium, type Browser, type Page } from "playwright"

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
}

export interface ScrapeResult {
  ok: boolean
  html?: string
  data?: unknown
  error?: string
}

async function getBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) return browser
  const headless = isScrapeHeadless()
  const args = process.platform === "linux"
    ? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    : headless ? ["--no-sandbox", "--disable-setuid-sandbox"] : []
  browser = await chromium.launch({
    headless,
    args,
  })
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
  } = options

  let page: Page | null = null

  try {
    const b = await getBrowser()
    const context = await b.newContext({
      userAgent: userAgent ?? undefined,
      extraHTTPHeaders: headers ?? undefined,
      ignoreHTTPSErrors: true,
    })
    page = await context.newPage()

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout,
    })

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
    return result
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  } finally {
    if (page) {
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
    await browser.close()
    browser = null
  }
}

/**
 * Site adapter config: define once per site, then call scrape(withSiteAdapter(config, url)).
 * Makes the scraper adaptable to any website via a simple config object.
 */
export interface SiteAdapterConfig {
  /** Selector to wait for before extracting (e.g. ".profile-card" or "//main") */
  waitForSelector?: string
  /** Extra ms to wait after load for JS-rendered content */
  waitForTimeout?: number
  /** Navigation timeout (ms) */
  timeout?: number
  /** Extraction script (function body returning JSON-serializable data) */
  script?: string
  /** Request headers */
  headers?: Record<string, string>
  userAgent?: string
}

/** Build ScrapeOptions from a site adapter config and URL. Use with scrape(). */
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
