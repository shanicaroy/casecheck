/** GET /api/timings — "usually about Ns" per step: medians of logged runs, or the defaults. */
import { typicalTimings } from "@/src/lib/timings";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(await typicalTimings(), { headers: { "cache-control": "no-store" } });
}
