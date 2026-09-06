/**
 * POST /api/fetch  { url } → FetchResult
 *
 * A thin wrapper: it validates the request shape and hands the URL to step 1.
 * It runs on the Node.js runtime (a browser cannot run on the Edge runtime)
 * and is allowed up to 60 seconds, because a cold start unpacks Chromium.
 */
import { NextResponse } from "next/server";
import { fetchPage } from "@/src/steps/fetch";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const url = typeof body === "object" && body !== null ? (body as { url?: unknown }).url : undefined;
  if (typeof url !== "string" || url.trim() === "") {
    return NextResponse.json({ error: "Body must include a url string." }, { status: 400 });
  }

  const result = await fetchPage(url);
  return NextResponse.json(result);
}
