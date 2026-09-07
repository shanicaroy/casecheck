/**
 * POST /api/run  { url }  → newline-delimited JSON, one RunEvent per line,
 * written as each step finishes. The page reads the stream and updates the
 * step list live. See src/pipeline/run.ts for the events.
 */
import { runPipeline } from "@/src/pipeline/run";
import { errorMessage } from "@/src/steps/fetch";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(request: Request) {
  let url: unknown;
  try {
    ({ url } = (await request.json()) as { url?: unknown });
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  if (typeof url !== "string" || url.trim() === "") {
    return Response.json({ error: "Body must include a url string." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        for await (const event of runPipeline(url)) send(event);
      } catch (err) {
        send({ type: "run", status: "stopped", error: { reason: "unexpected", detail: errorMessage(err) } });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
