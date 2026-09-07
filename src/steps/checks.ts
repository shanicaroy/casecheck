/**
 * Step 4 of 6 — Run checks.
 *
 * Contract §6.4 (v0.2): "evaluate the chosen case study against §8. Every
 * finding carries the verbatim quote it rests on; no quote, no finding.
 * Vision on captured images per §7. Strong model."
 *
 * Input: the fetch result (text, images, embeds), the classification, and
 * the plan. The plan is consumed, not displayed: each dimension's emphasis
 * sets the depth asked for, and a press_hard question is put to the model
 * verbatim.
 *
 * Output: exactly twelve findings, A–L, typed, for the self-verify step.
 * Code enforces the rules that may not drift (see normalise).
 */
import { z } from "zod";
import type { FetchOk } from "./fetch";
import type { Classification } from "./classify";
import { DIMENSIONS, type DimensionId, type Plan, type PlannedDimension } from "./plan";
import { loadPrompt, loadRubric } from "../lib/prompts";
import { limits as defaultLimits, type Limits } from "../../config/limits";
import { callModel as defaultCallModel, ModelError, type CallImage, type CallModel, type ModelUsage } from "../lib/model";

const Verdict = z.enum(["present", "weak", "missing", "not_on_this_page"]);
const Confidence = z.enum(["high", "medium", "low"]);

/** What the model returns. Flat on purpose: structured output is strict about shape. */
export const ChecksProposalSchema = z.object({
  findings: z.array(
    z.object({
      id: z.enum(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]),
      verdict: Verdict,
      evidence_kind: z.enum(["quote", "image"]),
      /** Verbatim text from the page. Required when evidence_kind is quote. */
      quote: z.string().nullable(),
      /** 1-based index of a captured image. Required when evidence_kind is image. */
      image_index: z.number().int().nullable(),
      image_note: z.string().nullable(),
      confidence: Confidence,
      confidence_reason: z.string().nullable(),
      reasoning: z.string(),
      answer_to_question: z.string().nullable(),
      level_gap: z.string().nullable(),
    }),
  ),
  images_read: z.array(
    z.object({
      index: z.number().int(),
      narrative_recovered: z.string().nullable(),
      artefact_verified: z.string().nullable(),
    }),
  ),
  could_not_judge: z.array(z.string()),
});
export type ChecksProposal = z.infer<typeof ChecksProposalSchema>;

export type Evidence =
  | { kind: "quote"; text: string }
  | { kind: "image"; index: number; note: string };

/** One of the twelve. What slice 5 reads. */
export interface Finding {
  id: DimensionId;
  name: string;
  star: boolean;
  /** Copied from the plan so downstream steps need not join. */
  emphasis: PlannedDimension["emphasis"];
  question: string | null;
  verdict: z.infer<typeof Verdict>;
  /** Null only when status is dropped. */
  evidence: Evidence | null;
  confidence: z.infer<typeof Confidence>;
  confidenceReason: string | null;
  reasoning: string;
  answerToQuestion: string | null;
  /** What this finding would need to read as the target level. Tied to this finding by construction (§4.2). */
  levelGap: string | null;
  /** From rubric/dimensions.json: false for K (cross-cutting) and L (§8 scope note). */
  eligibleAsWeakest: boolean;
  status: "kept" | "dropped";
  dropReason: string | null;
}

export interface ChecksOk {
  ok: true;
  /** Exactly twelve, A–L in order. Dropped ones stay in place with status "dropped". */
  findings: Finding[];
  imagesRead: ChecksProposal["images_read"];
  /** The model's own list, plus the embedded-media line added by code. */
  couldNotJudge: string[];
  embedCount: number;
  /** Every place code overrode the model's proposal. */
  adjustments: string[];
  usage: ModelUsage;
}
export interface ChecksFail {
  ok: false;
  reason: "not_configured" | "refusal" | "invalid_output" | "api" | "unexpected";
  detail: string;
}
export type ChecksResult = ChecksOk | ChecksFail;

export interface ChecksDeps {
  callModel?: CallModel;
  limits?: Partial<Limits>;
}

export async function runChecks(fetched: FetchOk, classification: Classification, plan: Plan, deps: ChecksDeps = {}): Promise<ChecksResult> {
  const callModel = deps.callModel ?? defaultCallModel;
  const lim = { ...defaultLimits, ...deps.limits };
  const { user, images } = buildUserMessage(fetched, classification, plan, lim);

  let proposal: ChecksProposal;
  let usage: ModelUsage;
  try {
    ({ data: proposal, usage } = await callModel({
      tier: "strong",
      system: `${loadPrompt("checks")}\n\n---\n\n${loadRubric()}`,
      user,
      images,
      schema: ChecksProposalSchema,
      effort: "high",
      maxTokens: 16_000,
    }));
  } catch (err) {
    if (err instanceof ModelError) return { ok: false, reason: err.kind, detail: err.message };
    return { ok: false, reason: "unexpected", detail: err instanceof Error ? err.message : String(err) };
  }

  const { findings, adjustments } = normalise(proposal, plan, fetched.images.length, classification.external_case_study_links.length > 0);
  const embedCount = fetched.embeds.length;
  const couldNotJudge = [...proposal.could_not_judge];
  if (embedCount > 0) couldNotJudge.push(`${embedCount} embedded video${embedCount === 1 ? "" : "s"}/prototype${embedCount === 1 ? "" : "s"} not reviewed.`);
  if (fetched.imageCandidates > fetched.images.length) {
    couldNotJudge.push(`${fetched.imageCandidates - fetched.images.length} further page image${fetched.imageCandidates - fetched.images.length === 1 ? "" : "s"} beyond the cap of ${lim.imageCap} not read.`);
  }

  return { ok: true, findings, imagesRead: proposal.images_read, couldNotJudge, embedCount, adjustments, usage };
}

/**
 * The rules the model may not break, applied after it answers:
 *  - exactly twelve findings, A–L in rubric order; a missing one is a dropped finding
 *  - no quote, no finding: a quote-based finding with an empty quote is dropped;
 *    an image-based finding with no valid image index is dropped
 *  - an image-based finding is at most medium confidence (§7 v0.2 Images)
 *  - not_on_this_page is only available when a fuller version elsewhere was found
 *  - L is always low confidence and never eligible; K is never eligible
 *  - emphasis and question are copied from the plan
 */
export function normalise(proposal: ChecksProposal, plan: Plan, imageCount: number, hasExternalLink: boolean): { findings: Finding[]; adjustments: string[] } {
  const adjustments: string[] = [];
  const byId = new Map<DimensionId, ChecksProposal["findings"][number]>();
  for (const f of proposal.findings) {
    if (byId.has(f.id)) {
      adjustments.push(`Finding ${f.id} was returned twice; kept the first.`);
      continue;
    }
    byId.set(f.id, f);
  }

  const findings = DIMENSIONS.map((meta): Finding => {
    const planned = plan.dimensions.find((d) => d.id === meta.id)!;
    const base = {
      id: meta.id,
      name: meta.name,
      star: meta.star,
      emphasis: planned.emphasis,
      question: planned.question,
      eligibleAsWeakest: meta.weakestEligible !== false,
    };
    const p = byId.get(meta.id);
    if (!p) {
      adjustments.push(`Finding ${meta.id} was not returned by the model; recorded as dropped.`);
      return { ...base, verdict: "missing", evidence: null, confidence: "low", confidenceReason: null, reasoning: "", answerToQuestion: null, levelGap: null, status: "dropped", dropReason: "The model returned no finding for this dimension." };
    }

    let evidence: Evidence | null = null;
    let dropReason: string | null = null;
    if (p.evidence_kind === "quote") {
      const text = p.quote?.trim() ?? "";
      if (text) evidence = { kind: "quote", text };
      else dropReason = "No verbatim quote was given.";
    } else {
      const idx = p.image_index ?? 0;
      if (idx >= 1 && idx <= imageCount) evidence = { kind: "image", index: idx, note: p.image_note?.trim() || "" };
      else dropReason = `Image ${p.image_index ?? "(none)"} does not exist; ${imageCount} image${imageCount === 1 ? " was" : "s were"} captured.`;
    }

    let verdict = p.verdict;
    if (verdict === "not_on_this_page" && !hasExternalLink) {
      adjustments.push(`Finding ${meta.id} said not_on_this_page but no fuller version elsewhere was found; changed to missing.`);
      verdict = "missing";
    }

    let confidence = p.confidence;
    let confidenceReason = p.confidence_reason?.trim() || null;
    if (evidence?.kind === "image" && confidence === "high") {
      adjustments.push(`Finding ${meta.id} rests on an image; confidence capped at medium.`);
      confidence = "medium";
      confidenceReason ??= "Grounded in an image rather than the page text.";
    }
    if (meta.alwaysLight && confidence !== "low") {
      adjustments.push(`Finding ${meta.id} is a surface signal only in v1; confidence set to low.`);
      confidence = "low";
      confidenceReason ??= "Craft is judged at surface level only in v1.";
    }
    if (confidence !== "high" && !confidenceReason) {
      confidenceReason = "No reason given.";
    }

    if (dropReason) adjustments.push(`Finding ${meta.id} dropped: ${dropReason}`);

    return {
      ...base,
      verdict,
      evidence,
      confidence,
      confidenceReason,
      reasoning: p.reasoning,
      answerToQuestion: planned.emphasis === "press_hard" ? p.answer_to_question?.trim() || null : null,
      levelGap: verdict === "present" ? null : p.level_gap?.trim() || null,
      status: dropReason ? "dropped" : "kept",
      dropReason,
    };
  });

  return { findings, adjustments };
}

/** Everything the model is shown: text first, then the images with labels. */
export function buildUserMessage(fetched: FetchOk, c: Classification, plan: Plan, lim: Limits): { user: string; images: CallImage[] } {
  const textTruncated = fetched.text.length > lim.maxTextChars;
  const text = textTruncated ? fetched.text.slice(0, lim.maxTextChars) : fetched.text;

  const planLines = plan.dimensions.map((d) => {
    const head = `${d.id}${d.star ? " ★" : ""} ${d.name} — ${d.emphasis}`;
    if (d.emphasis === "press_hard") return `${head}. Answer explicitly: ${d.question}`;
    if (d.emphasis === "light") return `${head}: one sentence.`;
    return `${head}.`;
  });

  const inventory = Object.entries(c.inventory)
    .map(([part, item]) => `- ${part}: ${item.status}${item.evidence ? ` — "${item.evidence}"` : ""}`)
    .join("\n");
  const external = c.external_case_study_links.length
    ? c.external_case_study_links.map((l) => `- ${l.text} → ${l.href}`).join("\n") +
      "\nThe fuller version was NOT read. Use not_on_this_page for anything that could live there."
    : "(none found) — not_on_this_page is not available for this page.";

  const embeds = fetched.embeds.length
    ? `${fetched.embeds.length} embedded item(s) detected and not analysed: ${fetched.embeds.map((e) => e.kind).join(", ")}.`
    : "No embedded media detected.";

  const imageIntro = fetched.images.length
    ? `${fetched.images.length} page image(s) follow the text, chosen because they sit next to thin text. Cite them by index.`
    : "No page images were captured.";

  const user = [
    "<levels>",
    `Current level: ${plan.levels.current} (${plan.levels.currentSource})`,
    `Target level: ${plan.levels.target} (${plan.levels.targetSource === "stated" ? "stated by the designer" : "assumed: one step up"})`,
    "</levels>",
    "",
    "<plan>",
    plan.summary,
    ...planLines,
    "</plan>",
    "",
    "<classification>",
    `Case study: ${c.case_studies[0]?.title ?? "(untitled)"}`,
    `Problem type: ${c.problem_type}`,
    `Case type: ${c.case_type.join(", ") || "unclear"}`,
    `Seniority read: ${c.seniority} (confidence ${c.seniority_confidence})`,
    "Inventory:",
    inventory,
    "Links to fuller versions elsewhere:",
    external,
    `Assumptions so far: ${c.assumptions.length ? c.assumptions.join(" | ") : "(none)"}`,
    "</classification>",
    "",
    "<embedded_media>",
    embeds,
    "</embedded_media>",
    "",
    textTruncated ? `Note: the page text was cut at ${lim.maxTextChars} characters.` : "",
    "<page_text>",
    text,
    "</page_text>",
    "",
    "<images>",
    imageIntro,
    "</images>",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const images: CallImage[] = fetched.images.map((img) => ({
    label: `Image ${img.index} of ${fetched.images.length}: alt "${img.alt || "(none)"}", ${Math.round(img.position * 100)}% down the page, ${img.width}×${img.height}, ${img.nearbyWords} words of text nearby.`,
    mediaType: img.mediaType,
    data: img.data,
  }));

  return { user, images };
}
