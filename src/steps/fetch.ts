/**
 * Step 1 of 6 — Fetch.
 *
 * Contract §6.1 (v0.2): "retrieve the URL on Case Check's own server. Capture
 * visible text (de-duplicated), every link with its visible text, and
 * images/media per §7."
 *
 * What this step does:   open the URL in a real headless browser, wait for it
 *                        to settle, and return the visible text, the links,
 *                        up to `limits.imageCap` page images (those next to
 *                        thin text first), a list of embedded media, and raw
 *                        facts about the page.
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
import { cleanText, wordCount } from "../lib/text";
import { launchBrowser } from "../lib/browser";
import { limits as defaultLimits, type Limits } from "../../config/limits";

export interface FetchOptions {
  /** Give up on navigation after this long. Default 30s. */
  timeoutMs?: number;
  /** After the DOM is ready, wait up to this long for network activity to stop. Default 8s. Best effort. */
  settleMs?: number;
  /** Capture images (contract §7 v0.2). Default true. */
  captureImages?: boolean;
  limits?: Partial<Limits>;
}

/** One page image, screenshotted as it renders, so SVG and CSS images count too. */
export interface CapturedImage {
  /** 1-based, in page order, as the check step will cite it. */
  index: number;
  alt: string;
  width: number;
  height: number;
  /** How far down the page, 0–1. */
  position: number;
  /** Words of narrative within ~500px above and below. Low means thin text nearby. */
  nearbyWords: number;
  mediaType: "image/jpeg";
  /** Base64 JPEG. Held in memory for the run only (§9); stripped before anything reaches the browser. */
  data: string;
}

/** Embedded media, detected and counted, never analysed (contract §7 v0.2). */
export interface Embed {
  kind: "youtube" | "loom" | "figma" | "video" | "iframe" | "other";
  src: string;
}

export interface PageLink {
  text: string;
  href: string;
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
  /** Raw signal for the classify step. Counts <img> only; SVG and CSS images are missed. */
  imageCount: number;
  /**
   * Words of text outside navigation, header, footer and asides, de-duplicated.
   * The too-thin floor (§5) is judged on this, not on wordCount.
   */
  narrativeWordCount: number;
  /** Every link with visible text, so later steps can name case studies and spot "full case study elsewhere". */
  links: PageLink[];
  /** Up to limits.imageCap images, thin-text-adjacent first, in page order. */
  images: CapturedImage[];
  /** How many images qualified before the cap. */
  imageCandidates: number;
  embeds: Embed[];
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
  | "not_html"      // server answered, but with something we don't read yet (e.g. a PDF)
  | "browser_unavailable" // the headless browser could not start on this machine (a hosting problem, not the portfolio's)
  | "unexpected";   // something threw that we did not anticipate; detail carries the message

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

  let browser;
  try {
    browser = await launchBrowser();
  } catch (err) {
    return fail("browser_unavailable", errorMessage(err));
  }
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
    const lim = { ...defaultLimits, ...opts.limits };

    // Scroll through the page once so lazy-loaded images render.
    await autoScroll(page);

    const rawText = await page.evaluate(() => document.body?.innerText ?? "");
    const imageCount = await page.evaluate(() => document.images.length);
    const links = await page.evaluate(() => {
      const seen = new Set<string>();
      const out: { text: string; href: string }[] = [];
      for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
        const href = a.href;
        const text = (a.innerText || a.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
        if (!/^https?:/.test(href) || text === "" || seen.has(href)) continue;
        seen.add(href);
        out.push({ text, href });
        if (out.length >= 200) break;
      }
      return out;
    });

    // scanPage is sent to the browser as source. Under tsx (dev and tests) the
    // transpiler wraps its inner helpers in a `__name(fn, "name")` call that
    // does not exist in the page, so define it there first. Harmless elsewhere.
    await page.evaluate(() => {
      (window as unknown as { __name?: (fn: unknown) => unknown }).__name ??= (fn: unknown) => fn;
    });
    const scan = await page.evaluate(scanPage, { minW: lim.minImageWidth, minH: lim.minImageHeight });
    const text = cleanText(rawText);
    const narrativeWordCount = wordCount(cleanText(scan.narrativeText));
    const embeds = scan.embeds as Embed[];

    const images: CapturedImage[] = [];
    if (opts.captureImages !== false) {
      // Thin-text-adjacent first, larger first on ties; then shown in page order.
      const chosen = [...scan.candidates]
        .sort((a, b) => a.nearbyWords - b.nearbyWords || b.width * b.height - a.width * a.height)
        .slice(0, lim.imageCap)
        .sort((a, b) => a.top - b.top);
      for (const c of chosen) {
        try {
          const buf = await page.locator(`[data-casecheck-img="${c.id}"]`).first().screenshot({ type: "jpeg", quality: 70, timeout: 8_000 });
          images.push({
            index: images.length + 1,
            alt: c.alt,
            width: Math.round(c.width),
            height: Math.round(c.height),
            position: c.position,
            nearbyWords: c.nearbyWords,
            mediaType: "image/jpeg",
            data: buf.toString("base64"),
          });
        } catch {
          // An image that will not screenshot is skipped; the count of candidates still says it was there.
        }
      }
    }

    return {
      ok: true,
      requestedUrl,
      finalUrl: page.url(),
      status,
      title,
      text,
      wordCount: wordCount(text),
      imageCount,
      narrativeWordCount,
      links,
      images,
      imageCandidates: scan.candidates.length,
      embeds,
      fetchedAt: new Date(started).toISOString(),
      durationMs: Date.now() - started,
    };
  } finally {
    await browser.close();
  }
}

/** First line of an error message, capped, so it can sit in a JSON result. */
export function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.split("\n")[0].slice(0, 400);
}

function parseHttpUrl(input: string): URL | null {
  try {
    const url = new URL(input.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Scroll to the bottom in viewport steps and back, so lazy images load. Best effort. */
async function autoScroll(page: import("playwright-core").Page): Promise<void> {
  try {
    await page.evaluate(async () => {
      const step = window.innerHeight;
      const max = Math.min(document.body.scrollHeight, 20_000);
      for (let y = 0; y < max; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(300);
  } catch {
    // Scrolling is a nicety; never fail the fetch over it.
  }
}

/**
 * Runs inside the page. Finds narrative text (outside nav/header/footer/aside),
 * image candidates with how much text sits near each, and embedded media.
 * Tags each candidate with data-casecheck-img so it can be screenshotted.
 */
function scanPage({ minW, minH }: { minW: number; minH: number }) {
  const STRIP = 'nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"], script, style, noscript';
  const stripped = (el: Element | null) => !!el && !!el.closest(STRIP);
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  };

  // Narrative text blocks with their vertical position.
  const blocks: { top: number; words: number }[] = [];
  const narrative: string[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const t = (node.textContent || "").replace(/\s+/g, " ").trim();
    const el = node.parentElement;
    if (!t || !el || stripped(el) || !visible(el)) continue;
    const words = t.split(" ").length;
    const rect = (node.parentElement as Element).getBoundingClientRect();
    blocks.push({ top: rect.top + window.scrollY, words });
    narrative.push(t);
  }

  // Image candidates: <img>, inline <svg>, and elements painted with a background image.
  const docHeight = Math.max(document.body.scrollHeight, 1);
  const els = new Set<Element>();
  document.querySelectorAll("img, svg, picture").forEach((e) => els.add(e));
  document.querySelectorAll("div, section, figure, span, a").forEach((e) => {
    const bg = getComputedStyle(e).backgroundImage;
    if (bg && bg !== "none" && /url\(/.test(bg)) els.add(e);
  });

  const candidates: { id: number; alt: string; width: number; height: number; top: number; position: number; nearbyWords: number }[] = [];
  let id = 0;
  for (const el of els) {
    if (stripped(el) || !visible(el)) continue;
    if (el.tagName.toLowerCase() === "svg" && el.closest("img, picture")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < minW || r.height < minH) continue;
    // Skip an element that merely wraps another candidate.
    if (Array.from(el.querySelectorAll("img, svg")).some((inner) => inner !== el && inner.getBoundingClientRect().width >= minW)) continue;
    const top = r.top + window.scrollY;
    const centre = top + r.height / 2;
    const nearbyWords = blocks.filter((b) => Math.abs(b.top - centre) <= 500).reduce((n, b) => n + b.words, 0);
    const figcaption = el.closest("figure")?.querySelector("figcaption")?.textContent?.trim() || "";
    const alt = (el.getAttribute("alt") || el.getAttribute("aria-label") || el.getAttribute("title") || figcaption).replace(/\s+/g, " ").trim();
    el.setAttribute("data-casecheck-img", String(id));
    candidates.push({ id, alt, width: r.width, height: r.height, top, position: Math.min(1, top / docHeight), nearbyWords });
    id += 1;
    if (candidates.length >= 60) break;
  }

  // Embedded media: counted, never analysed.
  const embeds: { kind: string; src: string }[] = [];
  const kindOf = (src: string) =>
    /youtube\.com|youtu\.be/i.test(src) ? "youtube" : /loom\.com/i.test(src) ? "loom" : /figma\.com/i.test(src) ? "figma" : "iframe";
  document.querySelectorAll("iframe, embed, object").forEach((e) => {
    const src = e.getAttribute("src") || e.getAttribute("data") || "";
    if (!src || stripped(e)) return;
    embeds.push({ kind: kindOf(src), src: src.slice(0, 200) });
  });
  document.querySelectorAll("video").forEach((e) => {
    const src = e.getAttribute("src") || e.querySelector("source")?.getAttribute("src") || "(inline video)";
    if (!stripped(e)) embeds.push({ kind: "video", src: src.slice(0, 200) });
  });

  return { narrativeText: narrative.join("\n"), candidates, embeds };
}
