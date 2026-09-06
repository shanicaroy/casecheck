/**
 * GET /api/health — diagnostics for the hosting environment, nothing else.
 *
 * Answers, step by step, "can this server run the fetch step?" so a hosting
 * problem can be read off a JSON page instead of dug out of platform logs.
 * Safe to leave in: it reveals nothing about any portfolio.
 */
import { NextResponse } from "next/server";
import { errorMessage } from "@/src/steps/fetch";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const report: Record<string, unknown> = {
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    onVercel: Boolean(process.env.VERCEL),
    region: process.env.VERCEL_REGION ?? null,
  };

  try {
    const pw = await import("playwright-core");
    report.playwrightCore = { loaded: true, version: (pw as { default?: { version?: string } }).default?.version ?? "unknown" };
  } catch (err) {
    report.playwrightCore = { loaded: false, error: errorMessage(err) };
  }

  try {
    const sparticuz = (await import("@sparticuz/chromium")).default;
    const started = Date.now();
    const executablePath = await sparticuz.executablePath();
    report.chromium = { loaded: true, executablePath, unpackMs: Date.now() - started };
  } catch (err) {
    report.chromium = { loaded: false, error: errorMessage(err) };
  }

  try {
    const { launchBrowser } = await import("@/src/lib/browser");
    const started = Date.now();
    const browser = await launchBrowser();
    const version = browser.version();
    await browser.close();
    report.launch = { ok: true, browserVersion: version, launchMs: Date.now() - started };
  } catch (err) {
    report.launch = { ok: false, error: errorMessage(err) };
  }

  return NextResponse.json(report);
}
