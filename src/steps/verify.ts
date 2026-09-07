/**
 * Step 5 of 6 — Self-verify.
 *
 * Contract §6.5: "every claim from step 4 is re-checked against the fetched
 * source. Claims whose quote cannot be found are dropped. Claims made and
 * claims surviving are both counted and shown. This step exists to catch
 * failure #1 in §4."
 *
 * Design principle, decided: code first, model second.
 *
 *  Pass 1 — code, deterministic. A quote-based finding survives only if its
 *           quote literally exists in the de-duplicated source text (after
 *           punctuation normalisation). An image-based finding survives only
 *           if the cited image exists. No model, no appeal.
 *  Pass 2 — cheap model, one question per pass-1 survivor: does this evidence
 *           support this claim as stated? supports → unchanged;
 *           partially_supports → confidence down one level, reason noted;
 *           does_not_support → dropped.
 *
 * What leaves this step: `surviving` (typed so a dropped finding cannot be
 * in it) and `dropped` (for the owner view), plus the two counts.
 */
import { z } from "zod";
import type { FetchOk } from "./fetch";
import type { ChecksOk, Finding, Evidence } from "./checks";
import { loadPrompt } from "../lib/prompts";
import { quoteInSource } from "../lib/quotes";
import { callModel as defaultCallModel, ModelError, type CallImage, type CallModel, type ModelUsage } from "../lib/model";

export const SupportSchema = z.object({
  answer: z.enum(["supports", "partially_supports", "does_not_support"]),
  reason: z.string(),
});
export type Support = z.infer<typeof SupportSchema>;

/**
 * A finding that survived both passes. Distinct from Finding on purpose: no
 * status field, evidence never null. Slice 6 takes this type and nothing else,
 * so a dropped finding cannot reach it.
 */
export interface SurvivingFinding extends Omit<Finding, "status" | "dropReason" | "evidence"> {
  evidence: Evidence;
  verification: "supports" | "partially_supports";
  verificationNote: string;
}

export interface DroppedFinding {
  id: Finding["id"];
  name: string;
  /** Where it fell: in step 4 for lacking evidence, in pass 1, or in pass 2. */
  stage: "checks" | "quote_not_found" | "image_not_found" | "does_not_support";
  reason: string;
  /** What the model claimed, kept for the owner view and the eval. */
  verdict: Finding["verdict"];
  quote: string | null;
  reasoning: string;
}

export interface Downgrade {
  id: Finding["id"];
  from: Finding["confidence"];
  to: Finding["confidence"];
  reason: string;
}

export interface VerifyOk {
  ok: true;
  surviving: SurvivingFinding[];
  dropped: DroppedFinding[];
  downgraded: Downgrade[];
  /** Findings the check model returned (with or without usable evidence). */
  claimsMade: number;
  /** Findings that passed both passes. */
  claimsSurviving: number;
  /** One line per finding for the owner view, in order. */
  trail: string[];
  /** Summed over all pass-2 calls. */
  usage: ModelUsage;
}
export interface VerifyFail {
  ok: false;
  reason: "not_configured" | "refusal" | "invalid_output" | "api" | "unexpected";
  detail: string;
}
export type VerifyResult = VerifyOk | VerifyFail;

export interface VerifyDeps {
  callModel?: CallModel;
  /** Pass-2 calls run in parallel up to this many at once. */
  concurrency?: number;
}

export async function verify(checks: ChecksOk, fetched: FetchOk, deps: VerifyDeps = {}): Promise<VerifyResult> {
  const callModel = deps.callModel ?? defaultCallModel;
  const started = Date.now();

  const dropped: DroppedFinding[] = [];
  const trail: string[] = [];
  const candidates: Finding[] = [];
  let claimsMade = 0;

  // Pass 1 — code.
  for (const f of checks.findings) {
    if (f.status === "dropped") {
      if (f.dropReason !== "The model returned no finding for this dimension.") {
        claimsMade += 1;
        dropped.push(drop(f, "checks", f.dropReason ?? "No usable evidence."));
        trail.push(`${f.id}: dropped in step 4 — ${f.dropReason}`);
      } else {
        trail.push(`${f.id}: no finding returned in step 4`);
      }
      continue;
    }
    claimsMade += 1;
    const ev = f.evidence!;
    if (ev.kind === "quote") {
      if (!quoteInSource(ev.text, fetched.text)) {
        dropped.push(drop(f, "quote_not_found", "The quote does not appear in the page text."));
        trail.push(`${f.id}: dropped — quote not found in source`);
        continue;
      }
    } else if (ev.index < 1 || ev.index > fetched.images.length) {
      dropped.push(drop(f, "image_not_found", `Image ${ev.index} was not captured.`));
      trail.push(`${f.id}: dropped — image ${ev.index} not captured`);
      continue;
    }
    candidates.push(f);
  }

  // Pass 2 — model, one question per pass-1 survivor.
  const system = loadPrompt("verify");
  let answers: { finding: Finding; support: Support; usage: ModelUsage }[];
  try {
    answers = await mapLimit(candidates, deps.concurrency ?? 4, async (finding) => {
      const image = finding.evidence!.kind === "image" ? fetched.images[finding.evidence!.index - 1] : null;
      const images: CallImage[] | undefined = image
        ? [{ label: `Image ${image.index}: alt "${image.alt || "(none)"}", ${Math.round(image.position * 100)}% down the page.`, mediaType: image.mediaType, data: image.data }]
        : undefined;
      const { data, usage } = await callModel({
        tier: "cheap",
        system,
        user: buildQuestion(finding),
        images,
        schema: SupportSchema,
        effort: "low",
        maxTokens: 600,
      });
      return { finding, support: data, usage };
    });
  } catch (err) {
    if (err instanceof ModelError) return { ok: false, reason: err.kind, detail: err.message };
    return { ok: false, reason: "unexpected", detail: err instanceof Error ? err.message : String(err) };
  }

  const surviving: SurvivingFinding[] = [];
  const downgraded: Downgrade[] = [];
  for (const { finding, support } of answers) {
    const { status: _s, dropReason: _d, evidence, ...rest } = finding;
    if (support.answer === "does_not_support") {
      dropped.push(drop(finding, "does_not_support", support.reason));
      trail.push(`${finding.id}: dropped — evidence does not support the claim: ${support.reason}`);
      continue;
    }
    let confidence = finding.confidence;
    let confidenceReason = finding.confidenceReason;
    if (support.answer === "partially_supports") {
      const to = oneLevelDown(confidence);
      if (to !== confidence) {
        downgraded.push({ id: finding.id, from: confidence, to, reason: support.reason });
        trail.push(`${finding.id}: kept, confidence ${confidence} → ${to} — ${support.reason}`);
      } else {
        trail.push(`${finding.id}: kept at ${confidence} (already lowest) — ${support.reason}`);
      }
      confidence = to;
      confidenceReason = [confidenceReason, `Verification: ${support.reason}`].filter(Boolean).join(" ");
    } else {
      trail.push(`${finding.id}: verified`);
    }
    surviving.push({
      ...rest,
      evidence: evidence!,
      confidence,
      confidenceReason,
      verification: support.answer,
      verificationNote: support.reason,
    });
  }

  // Keep rubric order whatever order the parallel answers arrived in.
  surviving.sort((a, b) => a.id.localeCompare(b.id));
  dropped.sort((a, b) => a.id.localeCompare(b.id));
  trail.sort((a, b) => a.localeCompare(b));

  const usage: ModelUsage = answers.reduce(
    (acc, a) => ({
      ...acc,
      model: a.usage.model,
      inputTokens: acc.inputTokens + a.usage.inputTokens,
      outputTokens: acc.outputTokens + a.usage.outputTokens,
      cacheReadTokens: acc.cacheReadTokens + a.usage.cacheReadTokens,
    }),
    { tier: "cheap" as const, model: "(no calls)", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, durationMs: 0 },
  );
  usage.durationMs = Date.now() - started;

  return { ok: true, surviving, dropped, downgraded, claimsMade, claimsSurviving: surviving.length, trail, usage };
}

function drop(f: Finding, stage: DroppedFinding["stage"], reason: string): DroppedFinding {
  return {
    id: f.id,
    name: f.name,
    stage,
    reason,
    verdict: f.verdict,
    quote: f.evidence?.kind === "quote" ? f.evidence.text : null,
    reasoning: f.reasoning,
  };
}

export function oneLevelDown(c: Finding["confidence"]): Finding["confidence"] {
  return c === "high" ? "medium" : "low";
}

/** The one question put to the model for one finding. */
export function buildQuestion(f: Finding): string {
  const ev = f.evidence!;
  const evidence =
    ev.kind === "quote"
      ? `Evidence, a verbatim quote from the page:\n"${ev.text}"`
      : `Evidence, a page image (attached). Note on what it shows: ${ev.note || "(no note)"}`;
  return [
    `Dimension ${f.id}: ${f.name}`,
    `Verdict: ${f.verdict}`,
    `Reasoning: ${f.reasoning}`,
    f.answerToQuestion ? `Answer to the planned question: ${f.answerToQuestion}` : "",
    "",
    evidence,
    "",
    "Does this evidence support this claim as stated?",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}
