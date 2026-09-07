/**
 * Step 2 of 6 — Classify.
 *
 * Contract §6.2: "what kind of portfolio is this, how many case studies, which
 * one to review (ask if ambiguous per §5). Cheap model."
 *
 * Input: the fetch step's result (title, visible text, links).
 * Output: structured facts about the page, validated against the schema
 * below, plus one decision made in code, not by the model: whether the tool
 * must stop and ask which case study to review.
 *
 * The prompt lives in prompts/classify.md. This file owns the shape of the
 * answer and the rules around it.
 */
import { z } from "zod";
import type { FetchOk } from "./fetch";
import { loadPrompt } from "../lib/prompts";
import { callModel as defaultCallModel, ModelError, type CallModel, type ModelUsage } from "../lib/model";

/** How much page text we hand the model. Beyond this we truncate and say so. */
export const MAX_TEXT_CHARS = 60_000;

const Status = z.enum(["present", "weak", "missing"]);
const InventoryItem = z.object({
  status: Status,
  /** Verbatim quote from the page, or null when missing. */
  evidence: z.string().nullable(),
});

export const ClassificationSchema = z.object({
  page_kind: z.enum(["single_case_study", "portfolio_index", "not_a_portfolio", "too_little_content"]),
  page_kind_reason: z.string(),
  case_studies: z.array(
    z.object({
      title: z.string(),
      url: z.string().nullable(),
      evidence: z.string(),
    }),
  ),
  problem_type: z.enum(["revamp", "zero_to_one", "unclear"]),
  /** An estimate offered to help, never a verdict (contract §2, §4.7). Always carries its own confidence. */
  seniority: z.enum(["junior", "mid", "senior", "unclear"]),
  seniority_confidence: z.enum(["high", "medium", "low"]),
  case_type: z.array(z.enum(["product_design", "research_only", "concept", "shipped", "student_project", "other"])),
  /** Contract §7 v0.2 "Inventory": the nine narrative parts the rubric asks about. */
  inventory: z.object({
    problem: InventoryItem,
    research: InventoryItem,
    design_decisions: InventoryItem,
    tradeoffs: InventoryItem,
    constraints: InventoryItem,
    role_clarity: InventoryItem,
    iteration: InventoryItem,
    outcome: InventoryItem,
    learnings: InventoryItem,
  }),
  external_case_study_links: z.array(z.object({ text: z.string(), href: z.string() })),
  assumptions: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]),
  notes: z.string(),
});

export type Classification = z.infer<typeof ClassificationSchema>;

export interface ClassifyOk {
  ok: true;
  classification: Classification;
  /**
   * Contract §5 + decision log: on a portfolio index with several case
   * studies and no single one indicated, stop and ask. Decided in code so the
   * rule cannot drift with the model's mood.
   */
  needsChoice: boolean;
  /** Index into classification.case_studies, when one is chosen. */
  selectedIndex: number | null;
  /** True when the page text was cut to MAX_TEXT_CHARS before the model saw it. */
  textTruncated: boolean;
  usage: ModelUsage;
}

export interface ClassifyFail {
  ok: false;
  reason: "not_configured" | "refusal" | "invalid_output" | "api" | "unexpected";
  detail: string;
}

export type ClassifyResult = ClassifyOk | ClassifyFail;

export interface ClassifyDeps {
  callModel?: CallModel;
}

export async function classify(fetched: FetchOk, deps: ClassifyDeps = {}): Promise<ClassifyResult> {
  const callModel = deps.callModel ?? defaultCallModel;
  const { user, textTruncated } = buildUserMessage(fetched);

  let data: Classification;
  let usage: ModelUsage;
  try {
    ({ data, usage } = await callModel({
      tier: "cheap",
      system: loadPrompt("classify"),
      user,
      schema: ClassificationSchema,
      effort: "low",
      maxTokens: 4_000,
    }));
  } catch (err) {
    if (err instanceof ModelError) return { ok: false, reason: err.kind, detail: err.message };
    return { ok: false, reason: "unexpected", detail: err instanceof Error ? err.message : String(err) };
  }

  const { needsChoice, selectedIndex } = decideSelection(data);
  return { ok: true, classification: data, needsChoice, selectedIndex, textTruncated, usage };
}

/** The rule for which case study gets reviewed. Code, not model. */
export function decideSelection(c: Classification): { needsChoice: boolean; selectedIndex: number | null } {
  if (c.page_kind === "single_case_study") return { needsChoice: false, selectedIndex: c.case_studies.length > 0 ? 0 : null };
  if (c.page_kind === "portfolio_index") {
    if (c.case_studies.length > 1) return { needsChoice: true, selectedIndex: null };
    if (c.case_studies.length === 1) return { needsChoice: false, selectedIndex: 0 };
  }
  return { needsChoice: false, selectedIndex: null };
}

/** Everything the model is shown, in one string, so it can be logged and inspected. */
export function buildUserMessage(fetched: FetchOk): { user: string; textTruncated: boolean } {
  const textTruncated = fetched.text.length > MAX_TEXT_CHARS;
  const text = textTruncated ? fetched.text.slice(0, MAX_TEXT_CHARS) : fetched.text;
  const links = fetched.links
    .slice(0, 150)
    .map((l) => `- ${l.text} → ${l.href}`)
    .join("\n");

  const user = [
    `URL: ${fetched.finalUrl}`,
    `Title: ${fetched.title || "(none)"}`,
    `Word count: ${fetched.wordCount}`,
    textTruncated ? `Note: the page text was cut at ${MAX_TEXT_CHARS} characters.` : "",
    "",
    "<page_text>",
    text,
    "</page_text>",
    "",
    "<links>",
    links || "(no links with visible text)",
    "</links>",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { user, textTruncated };
}
