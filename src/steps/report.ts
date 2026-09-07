/**
 * Step 6 of 6 — Report.
 *
 * Contract §6.6 / §14: assemble the structured review, typed, in the §14
 * order. Two jobs, kept separate so the ranking can be inspected without
 * touching the checks:
 *
 *  CHOOSE  — code, deterministic. From the surviving findings, pick the
 *            single weakest part. Only ★-eligible dimensions can win.
 *            Rule, in order:
 *              1. a trust problem on H (fabricated or unverifiable outcome)
 *                 outranks any ordinary gap (worked example 1);
 *              2. missing over weak over not-on-this-page;
 *              3. the plan's emphasis (press_hard > normal > light);
 *              4. confidence (high > medium > low);
 *              5. a remaining tie goes to the model, which must pick from
 *                 the tied set on which matters more for the target.
 *            Every input to the ranking is returned so the owner can see
 *            why one won.
 *
 *  GENERATE — the model writes the prose (why weak, why it outranks, the
 *            fix, what's missing toward the target, secondary notes) from
 *            surviving findings only. It never sees a dropped finding: this
 *            file takes VerifyOk.surviving and nothing else. Code assembles
 *            the rest of §14 (inventory, could-not-judge, assumptions, the
 *            verification sentence) from data that already exists.
 */
import { z } from "zod";
import type { Classification } from "./classify";
import type { Plan, DimensionId } from "./plan";
import type { ChecksOk, Evidence } from "./checks";
import type { VerifyOk, SurvivingFinding } from "./verify";
import type { Level } from "../lib/levels";
import { loadPrompt } from "../lib/prompts";
import { callModel as defaultCallModel, ModelError, type CallModel, type ModelUsage } from "../lib/model";

// ---------------------------------------------------------------- CHOOSE

const VERDICT_RANK = { missing: 3, weak: 2, not_on_this_page: 1, present: 0 } as const;
const EMPHASIS_RANK = { press_hard: 3, normal: 2, light: 1 } as const;
const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 } as const;

/** One row of the ranking, kept for the owner view. */
export interface RankingRow {
  id: DimensionId;
  name: string;
  eligible: boolean;
  candidate: boolean;
  trustIssue: boolean;
  verdict: SurvivingFinding["verdict"];
  emphasis: SurvivingFinding["emphasis"];
  confidence: SurvivingFinding["confidence"];
  /** [trust, verdict, emphasis, confidence] — compared left to right, higher wins. */
  score: [number, number, number, number];
  excludedBecause: string | null;
}

export interface Choice {
  /** The winner, or null when nothing eligible is weak (a strong case study). */
  winner: SurvivingFinding | null;
  /** More than one when the rule could not separate them; the model then picks among these. */
  tied: SurvivingFinding[];
  ranking: RankingRow[];
}

export function chooseWeakest(surviving: SurvivingFinding[]): Choice {
  const rows: RankingRow[] = surviving.map((f) => {
    const gap = f.verdict !== "present";
    const excludedBecause = !f.eligibleAsWeakest ? "not a ★ dimension" : !gap ? "verdict is present" : null;
    return {
      id: f.id,
      name: f.name,
      eligible: f.eligibleAsWeakest,
      candidate: excludedBecause === null,
      trustIssue: f.trustIssue,
      verdict: f.verdict,
      emphasis: f.emphasis,
      confidence: f.confidence,
      score: [f.trustIssue && f.id === "H" ? 1 : 0, VERDICT_RANK[f.verdict], EMPHASIS_RANK[f.emphasis], CONFIDENCE_RANK[f.confidence]],
      excludedBecause,
    };
  });

  const candidates = rows.filter((r) => r.candidate).sort((a, b) => compareScores(b.score, a.score));
  if (candidates.length === 0) return { winner: null, tied: [], ranking: rows };

  const top = candidates[0];
  const tiedRows = candidates.filter((r) => compareScores(r.score, top.score) === 0);
  const byId = new Map(surviving.map((f) => [f.id, f]));
  const tied = tiedRows.map((r) => byId.get(r.id)!);
  return { winner: tied.length === 1 ? tied[0] : null, tied, ranking: rows };
}

function compareScores(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

// -------------------------------------------------------------- GENERATE

function proposalSchema(allowedIds: DimensionId[]) {
  const Id = z.enum(allowedIds as [DimensionId, ...DimensionId[]]);
  return z.object({
    weakest_part: z.object({
      chosen_id: Id,
      plain_words: z.string(),
      why_weak: z.string(),
      why_it_outranks: z.string(),
    }),
    one_fix: z.string(),
    one_fix_cites: z.array(z.enum(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"])),
    toward_target: z.string(),
    toward_target_cites: z.array(z.enum(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"])),
    secondary: z.array(z.object({ id: z.enum(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]), note: z.string() })),
  });
}
export type ReportProposal = z.infer<ReturnType<typeof proposalSchema>>;

/** The review, in the §14 order. Typed data; the page and the CLI render it. */
export interface Report {
  weakest_part: {
    id: DimensionId;
    name: string;
    plain_words: string;
    evidence: Evidence;
    why_weak: string;
    why_it_outranks: string;
    confidence: SurvivingFinding["confidence"];
    confidence_reason: string | null;
    trust_issue: boolean;
  } | null;
  one_fix: { text: string; target: Level; cites: DimensionId[] } | null;
  reads_as: {
    level: Classification["seniority"];
    confidence: Classification["seniority_confidence"];
    target: Level;
    target_source: Plan["levels"]["targetSource"];
    what_is_missing: string;
    cites: DimensionId[];
  };
  inventory: { part: string; status: "present" | "weak" | "missing"; evidence: string | null }[];
  secondary: { id: DimensionId; name: string; verdict: SurvivingFinding["verdict"]; note: string }[];
  could_not_judge: string[];
  assumptions: string[];
  verification: { made: number; verified: number; dropped: number; sentence: string };
}

export interface ReportOk {
  ok: true;
  report: Report;
  choice: Choice;
  /** Which id the model picked when the rule tied, or null. */
  tieBrokenBy: DimensionId | null;
  adjustments: string[];
  usage: ModelUsage | null;
}
export interface ReportFail {
  ok: false;
  reason: "not_configured" | "refusal" | "invalid_output" | "api" | "unexpected";
  detail: string;
}
export type ReportResult = ReportOk | ReportFail;

export interface ReportInputs {
  verified: VerifyOk;
  checks: Pick<ChecksOk, "couldNotJudge">;
  classification: Classification;
  plan: Plan;
  /** Assumptions made by the pipeline itself (following, defaults). */
  pipelineAssumptions?: string[];
}

export interface ReportDeps {
  callModel?: CallModel;
}

export async function buildReport(inputs: ReportInputs, deps: ReportDeps = {}): Promise<ReportResult> {
  const callModel = deps.callModel ?? defaultCallModel;
  const { verified, checks, classification: c, plan } = inputs;
  const surviving = verified.surviving; // SurvivingFinding[] only: a dropped finding cannot be here.
  const adjustments: string[] = [];

  const choice = chooseWeakest(surviving);
  const gaps = surviving.filter((f) => f.verdict !== "present");

  // Parts code assembles from existing data.
  const inventory = Object.entries(c.inventory).map(([part, item]) => ({ part: part.replace(/_/g, " "), status: item.status, evidence: item.evidence }));
  const could_not_judge = [
    ...c.external_case_study_links.map((l) => `A fuller version linked from this page was not read: ${l.text} (${l.href}).`),
    ...checks.couldNotJudge,
    "Visual craft was not assessed in depth (v1 judges the narrative).",
  ];
  const assumptions = [...c.assumptions, ...plan.levels.assumptions, ...(inputs.pipelineAssumptions ?? [])];
  const dropped = verified.claimsMade - verified.claimsSurviving;
  const verification = {
    made: verified.claimsMade,
    verified: verified.claimsSurviving,
    dropped,
    sentence:
      dropped === 0
        ? `It made ${verified.claimsMade} claims and could verify all of them against your page.`
        : `It made ${verified.claimsMade} claims and could verify ${verified.claimsSurviving} against your page; the ${dropped} it couldn't were dropped.`,
  };
  const readsAsBase = {
    level: c.seniority,
    confidence: c.seniority_confidence,
    target: plan.levels.target,
    target_source: plan.levels.targetSource,
  };

  // A strong case study: nothing eligible is weak. No model call; say so plainly.
  if (choice.tied.length === 0) {
    return {
      ok: true,
      report: {
        weakest_part: null,
        one_fix: null,
        reads_as: { ...readsAsBase, what_is_missing: "", cites: [] },
        inventory,
        secondary: gaps.map((f) => ({ id: f.id, name: f.name, verdict: f.verdict, note: f.reasoning })),
        could_not_judge,
        assumptions,
        verification,
      },
      choice,
      tieBrokenBy: null,
      adjustments: ["No ★ dimension was weak or missing among the verified findings, so no weakest part was named and the model was not asked to write one."],
      usage: null,
    };
  }

  const allowed = choice.tied.map((f) => f.id);
  let proposal: ReportProposal;
  let usage: ModelUsage;
  try {
    ({ data: proposal, usage } = await callModel({
      tier: "strong",
      system: loadPrompt("report"),
      user: buildUserMessage(surviving, choice, plan),
      schema: proposalSchema(allowed),
      effort: "high",
      maxTokens: 6_000,
    }));
  } catch (err) {
    if (err instanceof ModelError) return { ok: false, reason: err.kind, detail: err.message };
    return { ok: false, reason: "unexpected", detail: err instanceof Error ? err.message : String(err) };
  }

  // The schema already restricts chosen_id to the tied set; belt and braces.
  const winner = choice.tied.find((f) => f.id === proposal.weakest_part.chosen_id) ?? choice.tied[0];
  const tieBrokenBy = choice.tied.length > 1 ? winner.id : null;

  const survivingGapIds = new Set(gaps.map((f) => f.id));
  const cleanCites = (cites: DimensionId[], what: string): DimensionId[] => {
    const kept = [...new Set(cites)].filter((id) => survivingGapIds.has(id));
    if (kept.length !== new Set(cites).size) adjustments.push(`${what} cited a dimension that is not a surviving weak finding; those citations were removed.`);
    return kept;
  };
  let fixCites = cleanCites(proposal.one_fix_cites, "one_fix");
  if (!fixCites.includes(winner.id)) {
    adjustments.push("one_fix did not cite the weakest part; the citation was added.");
    fixCites = [winner.id, ...fixCites];
  }
  let targetCites = cleanCites(proposal.toward_target_cites, "toward_target");
  let what_is_missing = proposal.toward_target.trim();
  if (targetCites.length === 0) {
    // §4.2: level guidance with no finding behind it is generic advice. Fall back to the
    // winner's own level gap, which is tied to a finding by construction.
    adjustments.push("toward_target cited no surviving finding; replaced with the weakest part's own level gap.");
    what_is_missing = winner.levelGap ?? `${winner.name}: ${winner.reasoning}`;
    targetCites = [winner.id];
  }

  const secondary = proposal.secondary
    .filter((s) => s.id !== winner.id && survivingGapIds.has(s.id))
    .map((s) => ({ id: s.id, name: surviving.find((f) => f.id === s.id)!.name, verdict: surviving.find((f) => f.id === s.id)!.verdict, note: s.note }));
  if (secondary.length !== proposal.secondary.length) adjustments.push("secondary included the weakest part or a non-surviving dimension; those entries were removed.");

  const report: Report = {
    weakest_part: {
      id: winner.id,
      name: winner.name,
      plain_words: proposal.weakest_part.plain_words,
      evidence: winner.evidence,
      why_weak: proposal.weakest_part.why_weak,
      why_it_outranks: proposal.weakest_part.why_it_outranks,
      confidence: winner.confidence,
      confidence_reason: winner.confidenceReason,
      trust_issue: winner.trustIssue,
    },
    one_fix: { text: proposal.one_fix, target: plan.levels.target, cites: fixCites },
    reads_as: { ...readsAsBase, what_is_missing, cites: targetCites },
    inventory,
    secondary,
    could_not_judge,
    assumptions,
    verification,
  };

  return { ok: true, report, choice, tieBrokenBy, adjustments, usage };
}

/** Everything the model is shown. Surviving findings only, by type. */
export function buildUserMessage(surviving: SurvivingFinding[], choice: Choice, plan: Plan): string {
  const describe = (f: SurvivingFinding) =>
    [
      `${f.id} ${f.name}${f.star ? " ★" : ""} — ${f.verdict}, confidence ${f.confidence}${f.confidenceReason ? ` (${f.confidenceReason})` : ""}${f.trustIssue ? ", TRUST PROBLEM" : ""}`,
      f.evidence.kind === "quote" ? `  Quote: "${f.evidence.text}"` : `  Image ${f.evidence.index}: ${f.evidence.note}`,
      `  Reasoning: ${f.reasoning}`,
      f.answerToQuestion ? `  Answer to the planned question: ${f.answerToQuestion}` : "",
      f.levelGap ? `  Toward the target: ${f.levelGap}` : "",
    ]
      .filter(Boolean)
      .join("\n");

  const weakest =
    choice.tied.length === 1
      ? `Chosen by the ranking rule: ${choice.tied[0].id} ${choice.tied[0].name}.`
      : `The ranking rule tied these; choose the one that matters more for the target and say why: ${choice.tied.map((f) => f.id).join(", ")}.`;

  return [
    "<levels>",
    `Current level: ${plan.levels.current} (${plan.levels.currentSource})`,
    `Target level: ${plan.levels.target} (${plan.levels.targetSource === "stated" ? "stated by the designer" : "assumed: one step up"})`,
    "</levels>",
    "",
    "<weakest_part>",
    weakest,
    "</weakest_part>",
    "",
    "<surviving_findings>",
    ...surviving.map(describe),
    "</surviving_findings>",
  ].join("\n");
}

// ---------------------------------------------------------------- RENDER

/** Plain-text rendering in the §14 order, for the terminal and for reading. */
export function renderReportText(r: Report): string {
  const lines: string[] = [];
  if (r.weakest_part) {
    const w = r.weakest_part;
    lines.push(`THE WEAKEST PART: ${w.plain_words} (${w.id} ${w.name}${w.trust_issue ? ", a trust problem" : ""})`);
    lines.push(w.evidence.kind === "quote" ? `  Rests on: "${w.evidence.text}"` : `  Rests on: image ${w.evidence.index} (${w.evidence.note})`);
    lines.push(`  Why it's weak: ${w.why_weak}`);
    lines.push(`  Why it outranks the others: ${w.why_it_outranks}`);
    lines.push(`  Confidence: ${w.confidence}${w.confidence_reason ? ` (${w.confidence_reason})` : ""}`);
  } else {
    lines.push("THE WEAKEST PART: none found among the storytelling dimensions the tool can judge.");
  }
  lines.push("");
  lines.push(`THE ONE FIX (to read as ${r.reads_as.target}): ${r.one_fix ? r.one_fix.text : "nothing to fix at this level of the read."}`);
  lines.push("");
  lines.push(`READS AS ~${r.reads_as.level} (confidence ${r.reads_as.confidence}) · aiming for ${r.reads_as.target} (${r.reads_as.target_source === "stated" ? "stated" : "assumed"})`);
  lines.push(`  To read as ${r.reads_as.target}: ${r.reads_as.what_is_missing || "nothing on this page was found missing."}`);
  lines.push("");
  lines.push("WHAT'S ON THE PAGE");
  for (const i of r.inventory) lines.push(`  ${i.part}: ${i.status}${i.evidence ? ` — "${i.evidence}"` : ""}`);
  lines.push("");
  lines.push("SECONDARY");
  if (r.secondary.length === 0) lines.push("  (none)");
  for (const s of r.secondary) lines.push(`  ${s.id} ${s.name} (${s.verdict}): ${s.note}`);
  lines.push("");
  lines.push("COULDN'T JUDGE");
  for (const t of r.could_not_judge) lines.push(`  - ${t}`);
  lines.push("");
  lines.push("ASSUMPTIONS");
  if (r.assumptions.length === 0) lines.push("  (none)");
  for (const a of r.assumptions) lines.push(`  - ${a}`);
  lines.push("");
  lines.push(`HOW SURE IT IS: ${r.verification.sentence}`);
  return lines.join("\n");
}
