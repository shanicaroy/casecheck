/**
 * Step 3 of 6 — Plan.
 *
 * Contract §6.3: "from the classification and the stated target level, decide
 * where the weak points are most likely to be, shown before checks run. All
 * dimensions still run."
 *
 * Input: the classify step's result, plus optional stated levels.
 * Output: for each rubric dimension A–L, an emphasis and, when press_hard, the
 * specific question the check step must answer for this case. This is data
 * step 4 consumes, not just a display.
 *
 * The model proposes the plan from prompts/plan.md; code enforces the rules
 * that must never drift: all twelve present and in order, L always light,
 * press_hard always carries a question.
 */
import { z } from "zod";
import dimensions from "../../rubric/dimensions.json";
import type { Classification } from "./classify";
import { loadPrompt, loadRubric } from "../lib/prompts";
import { resolveLevels, type LevelInputs, type ResolvedLevels } from "../lib/levels";
import { callModel as defaultCallModel, ModelError, type CallModel, type ModelUsage } from "../lib/model";

export type DimensionId = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L";
export const DIMENSION_IDS = dimensions.map((d) => d.id as DimensionId);

export interface DimensionMeta {
  id: DimensionId;
  name: string;
  star: boolean;
  crossCutting?: boolean;
  alwaysLight?: boolean;
  /** False for K and L: never the weakest part. */
  weakestEligible?: boolean;
}
export const DIMENSIONS = dimensions as DimensionMeta[];

const Emphasis = z.enum(["press_hard", "normal", "light"]);

/** What the model returns. */
export const PlanProposalSchema = z.object({
  summary: z.string(),
  dimensions: z.array(
    z.object({
      id: z.enum(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]),
      emphasis: Emphasis,
      question: z.string().nullable(),
      reason: z.string(),
    }),
  ),
});
export type PlanProposal = z.infer<typeof PlanProposalSchema>;

export interface PlannedDimension {
  id: DimensionId;
  name: string;
  star: boolean;
  emphasis: z.infer<typeof Emphasis>;
  /** Present exactly when emphasis is press_hard. */
  question: string | null;
  reason: string;
}

/** What step 4 receives. */
export interface Plan {
  levels: ResolvedLevels;
  /** Two or three sentences for the designer, shown before the checks run. */
  summary: string;
  /** Exactly twelve, A–L in order. */
  dimensions: PlannedDimension[];
}

export interface PlanOk {
  ok: true;
  plan: Plan;
  /** Every place code overrode the model's proposal, for the owner view and the eval. */
  adjustments: string[];
  usage: ModelUsage;
}
export interface PlanFail {
  ok: false;
  reason: "not_configured" | "refusal" | "invalid_output" | "api" | "unexpected";
  detail: string;
}
export type PlanResult = PlanOk | PlanFail;

export interface PlanDeps {
  callModel?: CallModel;
}

export async function plan(classification: Classification, levelInputs: LevelInputs = {}, deps: PlanDeps = {}): Promise<PlanResult> {
  const callModel = deps.callModel ?? defaultCallModel;
  const levels = resolveLevels(levelInputs, classification.seniority);

  let proposal: PlanProposal;
  let usage: ModelUsage;
  try {
    ({ data: proposal, usage } = await callModel({
      tier: "cheap",
      system: `${loadPrompt("plan")}\n\n---\n\n${loadRubric()}`,
      user: buildUserMessage(classification, levels),
      schema: PlanProposalSchema,
      effort: "medium",
      maxTokens: 4_000,
    }));
  } catch (err) {
    if (err instanceof ModelError) return { ok: false, reason: err.kind, detail: err.message };
    return { ok: false, reason: "unexpected", detail: err instanceof Error ? err.message : String(err) };
  }

  const { dimensions: planned, adjustments } = normalise(proposal);
  return { ok: true, plan: { levels, summary: proposal.summary, dimensions: planned }, adjustments, usage };
}

/**
 * The rules the model may not break, applied after it answers:
 *  - all twelve dimensions, A–L, in rubric order, each once (missing → normal)
 *  - L is always light (contract §8 scope note)
 *  - press_hard without a question is downgraded to normal (no question, no press)
 *  - a question on a non-press_hard dimension is dropped
 */
export function normalise(proposal: PlanProposal): { dimensions: PlannedDimension[]; adjustments: string[] } {
  const adjustments: string[] = [];
  const byId = new Map<DimensionId, PlanProposal["dimensions"][number]>();
  for (const d of proposal.dimensions) {
    if (byId.has(d.id)) {
      adjustments.push(`Dimension ${d.id} was proposed twice; kept the first.`);
      continue;
    }
    byId.set(d.id, d);
  }

  const dimensions = DIMENSIONS.map((meta): PlannedDimension => {
    const proposed = byId.get(meta.id);
    if (!proposed) {
      adjustments.push(`Dimension ${meta.id} was missing from the proposal; set to normal.`);
      return { id: meta.id, name: meta.name, star: meta.star, emphasis: "normal", question: null, reason: "Not addressed by the plan; checked at normal depth." };
    }
    let emphasis = proposed.emphasis;
    let question = proposed.question?.trim() || null;
    if (meta.alwaysLight && emphasis !== "light") {
      adjustments.push(`Dimension ${meta.id} is always light in v1; proposal said ${emphasis}.`);
      emphasis = "light";
    }
    if (emphasis === "press_hard" && !question) {
      adjustments.push(`Dimension ${meta.id} was press_hard without a question; downgraded to normal.`);
      emphasis = "normal";
    }
    if (emphasis !== "press_hard" && question) {
      question = null;
    }
    return { id: meta.id, name: meta.name, star: meta.star, emphasis, question, reason: proposed.reason };
  });

  return { dimensions, adjustments };
}

/** Everything the model is shown. */
export function buildUserMessage(c: Classification, levels: ResolvedLevels): string {
  const inventory = Object.entries(c.inventory)
    .map(([part, item]) => `- ${part}: ${item.status}${item.evidence ? ` — "${item.evidence}"` : ""}`)
    .join("\n");
  const external = c.external_case_study_links.length
    ? c.external_case_study_links.map((l) => `- ${l.text} → ${l.href}`).join("\n")
    : "(none found)";
  const chosen = c.case_studies[0];
  return [
    "<classification>",
    `Case study: ${chosen ? chosen.title : "(untitled)"}`,
    `Page kind: ${c.page_kind} — ${c.page_kind_reason}`,
    `Problem type: ${c.problem_type}`,
    `Seniority read: ${c.seniority} (confidence ${c.seniority_confidence})`,
    `Case type: ${c.case_type.join(", ") || "unclear"}`,
    "Inventory:",
    inventory,
    "Links to fuller versions elsewhere:",
    external,
    `Assumptions so far: ${c.assumptions.length ? c.assumptions.join(" | ") : "(none)"}`,
    `Classification confidence: ${c.confidence}${c.notes ? ` — ${c.notes}` : ""}`,
    "</classification>",
    "",
    "<levels>",
    `Current level: ${levels.current} (${levels.currentSource})`,
    `Target level: ${levels.target} (${levels.targetSource === "stated" ? "stated by the designer" : "assumed: one step up"})`,
    "</levels>",
  ].join("\n");
}
