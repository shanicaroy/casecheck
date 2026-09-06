/**
 * One place that answers "which Chromium do we launch, and how?"
 *
 * The fetch step needs a real browser. Where that browser comes from depends on
 * where the code is running, and nothing else in the app should care:
 *
 *  1. PLAYWRIGHT_CHROMIUM_EXECUTABLE is set  → use exactly that binary.
 *     (Used in the build sandbox, which ships its own Chromium.)
 *  2. Running on Vercel (or CHROMIUM_SERVERLESS=1)  → use the slim Linux Chromium
 *     bundled by @sparticuz/chromium. Vercel functions have no browser installed,
 *     so we bring one along. It is compressed on disk and unpacked to /tmp on
 *     first use, which is why the first request after a cold start is slower.
 *  3. Otherwise (your laptop)  → use the Chromium that `npx playwright install
 *     chromium` downloads.
 *
 * HTTPS_PROXY / NO_PROXY are honoured in all three cases for machines that
 * require a proxy.
 */
import type { Browser, LaunchOptions } from "playwright-core";

export async function launchBrowser(): Promise<Browser> {
  // Loaded lazily so that a package that fails to load on the host surfaces
  // as a reported error from the fetch step, not a crash before any code runs.
  const { chromium } = await import("playwright-core");
  const proxyServer = process.env.HTTPS_PROXY;
  const common: LaunchOptions = {
    headless: true,
    proxy: proxyServer ? { server: proxyServer, bypass: process.env.NO_PROXY } : undefined,
  };

  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
    return chromium.launch({ ...common, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  }

  if (process.env.VERCEL || process.env.CHROMIUM_SERVERLESS === "1") {
    const sparticuz = (await import("@sparticuz/chromium")).default;
    return chromium.launch({
      ...common,
      args: sparticuz.args,
      executablePath: await sparticuz.executablePath(),
    });
  }

  // Local development: the full `playwright` package knows where its own
  // downloaded Chromium lives.
  const local = await import("playwright");
  return local.chromium.launch(common);
}
