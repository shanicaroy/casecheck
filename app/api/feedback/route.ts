/**
 * POST /api/feedback { runId, answer } → 204.
 *
 * "Was this the right call?" from the end of a report. Only the run id and the
 * answer are written, to the server log, for the evaluation. No URL, no page
 * text, no findings (contract §9).
 */
export const runtime = "nodejs";

const ANSWERS = new Set(["yes", "not_quite"]);

export async function POST(request: Request) {
  let body: { runId?: unknown; answer?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  if (typeof body.runId !== "string" || body.runId.length > 64 || typeof body.answer !== "string" || !ANSWERS.has(body.answer)) {
    return Response.json({ error: "Body must include a runId and an answer." }, { status: 400 });
  }
  console.info(JSON.stringify({ kind: "casecheck.feedback", runId: body.runId, answer: body.answer, at: new Date().toISOString() }));
  return new Response(null, { status: 204 });
}
