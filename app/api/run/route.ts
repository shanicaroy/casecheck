/**
 * POST /api/run → newline-delimited JSON, one event per line, written as each
 * step moves. Body: { url } for a link, or { text, images? } for the pasted
 * fallback (contract §5), plus the optional level fields.
 *
 * While the run is open, a heartbeat line is sent every few seconds. It carries
 * no content. It exists so the page can tell a slow step from a dropped
 * connection and say which one it is, instead of leaving the designer guessing.
 */
import { runPipeline } from "@/src/pipeline/run";
import { errorMessage } from "@/src/steps/fetch";
import { isLevel } from "@/src/lib/levels";
import { recordTimings } from "@/src/lib/timings";
import { PASTED_SOURCE, type PastedImage } from "@/src/steps/pasted";
import { limits } from "@/config/limits";

export const runtime = "nodejs";
// The strong-model check with images can take a couple of minutes on a cold start.
export const maxDuration = 300;

const HEARTBEAT_MS = 3000;
const MAX_IMAGE_B64 = 1_500_000;
const BASE64 = /^[A-Za-z0-9+/]+=*$/;

export async function POST(request: Request) {
  let body: { url?: unknown; text?: unknown; images?: unknown; currentLevel?: unknown; targetLevel?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const pastedText = typeof body.text === "string" && body.text.trim() !== "" ? body.text : null;
  const url = typeof body.url === "string" && body.url.trim() !== "" ? body.url.trim() : null;
  if (!url && !pastedText) {
    return Response.json({ error: "Body must include a url string or pasted text." }, { status: 400 });
  }
  if (pastedText && pastedText.length > limits.maxTextChars * 2) {
    return Response.json({ error: "The pasted text is too long." }, { status: 413 });
  }

  let images: PastedImage[] = [];
  if (pastedText && Array.isArray(body.images)) {
    for (const raw of body.images.slice(0, limits.imageCap)) {
      const img = raw as Partial<PastedImage>;
      if (
        typeof img?.data !== "string" || img.data.length > MAX_IMAGE_B64 || !BASE64.test(img.data) ||
        typeof img.width !== "number" || typeof img.height !== "number"
      ) {
        return Response.json({ error: "One of the screenshots could not be read." }, { status: 400 });
      }
      images.push({ data: img.data, width: Math.round(img.width), height: Math.round(img.height) });
    }
  }

  const options = {
    currentLevel: isLevel(body.currentLevel) ? body.currentLevel : undefined,
    targetLevel: isLevel(body.targetLevel) ? body.targetLevel : undefined,
    pasted: pastedText ? { text: pastedText, images } : undefined,
  };
  const source = pastedText ? PASTED_SOURCE : url!;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (obj: unknown) => {
        if (open) controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      const beat = setInterval(() => send({ type: "heartbeat", at: Date.now() }), HEARTBEAT_MS);
      try {
        for await (const event of runPipeline(source, options)) {
          send(event);
          // Only durations are kept, and only from runs that completed every step.
          if (event.type === "run" && event.status === "complete") await recordTimings(event.log.steps);
        }
      } catch (err) {
        send({ type: "run", status: "stopped", error: { reason: "unexpected", detail: errorMessage(err) } });
      } finally {
        clearInterval(beat);
        open = false;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
