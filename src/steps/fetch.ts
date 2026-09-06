/**
 * Step 1 of 6 — Fetch.
 *
 * Contract §6.1: "retrieve the URL. Tool call. Capture text and screenshots."
 * This slice captures TEXT only. Screenshots are a later slice.
 *
 * What this step does:   open the URL in a real headless browser, wait for it
 *                        to settle, and return the visible text plus a few raw
 *                        facts about the page (status, title, word and image
 *                        counts).
 * What this step does NOT do: it makes no judgement. It does not decide whether
 *                        the page is a portfolio, whether it is "empty" or
 *                        "images only", or which case study to review. Those are
 *                        step 2 (Classify), and the wording of every user-facing
 *                        error state is a product decision recorded elsewhere.
 *
 * Why a real browser and not a plain HTTP request: Notion, Framer, Behance and
 * most portfolio builders render their content with JavaScript. A plain request
 * returns a near-empty shell. A browser also gives us screenshots later without
 * changing this step's shape.
 */
import { chromium, type Browser } from "playwright";
import { cleanText, wordCount } from "../lib/text.js";

export interface FetchOptions {
  /** Give up on navigation after this long. Default 30s. */
  timeoutMs?: number;
  /** After the DOM is ready, wait up to this long for network activity to stop. Default 8s. Best effort. */
  settleMs?: number;
}

export interface FetchOk {
  ok: true;
  requestedUrl: string;
  /** Where we ended up after redirects. */
  finalUrl: string;
  status: number;
  title: string;
  /** Visible page text, cleaned and de-duplicated. */
  text: string;
  wordCount: number;
  /** Raw signal for the classify step (e.g. an images-only page). Not a judgement. */
  imageCount: number;
  fetchedAt: string;
  durationMs: number;
}

/**
 * Transport-level reasons only. These are facts about what happened on the
 * wire, not the designed error states from contract §7 (those are worded and
 * chosen in a later slice, and map onto these).
 */
export type FetchFailReason =
  | "invalid_url"   // not an http(s) URL we can open
  | "unreachable"   // DNS failure, connection refused, browser could not open it
  | "timeout"       // the page did not respond within timeoutMs
  | "http_error"    // server answered with a 4xx/5xx (404, 403 auth wall, 500…)
  | "not_html";     // server answered, but with something we don't read yet (e.g. a PDF)

export interface FetchFail {
  ok: false;
  requestedUrl: string;
  reason: FetchFailReason;
  /** Plain-language detail for logs. Not user-facing copy. */
  detail: string;
  status?: number;
  contentType?: string;
  durationMs: number;
}

export type FetchResult = FetchOk | FetchFail;

export async function fetchPage(requestedUrl: string, opts: FetchOptions = {}): Promise<FetchResult> {
  const started = Date.now();
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const settleMs = opts.settleMs ?? 8_000;
  const fail = (reason: FetchFailReason, detail: string, extra: Partial<FetchFail> = {}): FetchFail => ({
    ok: false,
    requestedUrl,
    reason,
    detail,
    durationMs: Date.now() - started,
    ...extra,
  });

  const url = parseHttpUrl(requestedUrl);
  if (!url) return fail("invalid_url", "Only http:// and https:// links can be fetched.");

  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      // A normal desktop UA. Some hosts serve an empty page to obvious bots.
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    let response;
    try {
      response = await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/Download is starting/i.test(message)) {
        return fail("not_html", "The link points to a file download (probably a PDF), not a web page.");
      }
      if (/Timeout/i.test(message)) {
        return fail("timeout", `No response within ${timeoutMs}ms.`);
      }
      return fail("unreachable", message.split("\n")[0]);
    }
    if (!response) return fail("unreachable", "The browser returned no response for this URL.");

    const status = response.status();
    const contentType = response.headers()["content-type"] ?? "";
    if (status >= 400) {
      return fail("http_error", `Server answered ${status}.`, { status, contentType });
    }
    if (!/text\/html/i.test(contentType)) {
      return fail("not_html", `Server sent "${contentType || "unknown"}", which this step does not read.`, {
        status,
        contentType,
      });
    }

    // Let JS-rendered content appear. If the network never goes quiet
    // (analytics, long-polling) we proceed with what we have rather than hang.
    await page.waitForLoadState("networkidle", { timeout: settleMs }).catch(() => {});

    const title = await page.title();
    const rawText = await page.evaluate(() => document.body?.innerText ?? "");
    const imageCount = await page.evaluate(() => document.images.length);
    const text = cleanText(rawText);

    return {
      ok: true,
      requestedUrl,
      finalUrl: page.url(),
      status,
      title,
      text,
      wordCount: wordCount(text),
      imageCount,
      fetchedAt: new Date(started).toISOString(),
      durationMs: Date.now() - started,
    };
  } finally {
    await browser.close();
  }
}

function parseHttpUrl(input: string): URL | null {
  try {
    const url = new URL(input.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/**
 * Environment hooks, both optional:
 *  - PLAYWRIGHT_CHROMIUM_EXECUTABLE: use a specific Chromium binary instead of
 *    the one `npx playwright install chromium` downloads.
 *  - HTTPS_PROXY / NO_PROXY: route the browser through a proxy when the
 *    machine requires one (the case in the sandbox this was first built in).
 */
async function launchBrowser(): Promise<Browser> {
  const proxyServer = process.env.HTTPS_PROXY;
  return chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    proxy: proxyServer ? { server: proxyServer, bypass: process.env.NO_PROXY } : undefined,
  });
}
