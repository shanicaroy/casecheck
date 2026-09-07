/**
 * Step 6 with a stand-in model. The ranking is code and needs no model; the
 * prose comes from the stand-in.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseWeakest, buildReport, renderReportText, type ReportProposal } from "../src/steps/report";
import type { SurvivingFinding, VerifyOk } from "../src/steps/verify";
import type { Classification } from "../src/steps/classify";
import { DIMENSION_IDS, type Plan } from "../src/steps/plan";
import type { CallModel } from "../src/lib/model";

function sf(id: SurvivingFinding["id"], over: Partial<SurvivingFinding> = {}): SurvivingFinding {
  return {
    id, name: `Dim ${id}`, star: "ABCDEH".includes(id), emphasis: "normal", question: null, verdict: "present",
    evidence: { kind: "quote", text: `quote ${id}` }, confidence: "high", confidenceReason: null, reasoning: `reasoning ${id}`,
    answerToQuestion: null, levelGap: `gap ${id}`, eligibleAsWeakest: "ABCDEH".includes(id), trustIssue: false,
    verification: "supports", verificationNote: "ok", ...over,
  };
}
const allPresent = () => DIMENSION_IDS.map((id) => sf(id));

const present = (evidence: string) => ({ status: "present" as const, evidence });
const missing = { status: "missing" as const, evidence: null };
const classification: Classification = {
  page_kind: "single_case_study", page_kind_reason: "one", case_studies: [{ title: "Huddle", url: null, evidence: "e" }],
  problem_type: "zero_to_one", seniority: "junior", seniority_confidence: "medium", case_type: ["concept"],
  inventory: { problem: present("p"), research: missing, design_decisions: missing, tradeoffs: missing, constraints: missing, role_clarity: missing, iteration: missing, outcome: present("o"), learnings: missing },
  external_case_study_links: [{ text: "Full case study on Behance", href: "https://behance.net/x" }],
  assumptions: ["Treated the page as one case study."], confidence: "high", notes: "",
};
const plan: Plan = {
  levels: { current: "junior", currentSource: "inferred", target: "mid", targetSource: "default_next_up", assumptions: ["No target level was given, so the review is framed toward mid, one step up from junior."] },
  summary: "s",
  dimensions: DIMENSION_IDS.map((id) => ({ id, name: `Dim ${id}`, star: "ABCDEH".includes(id), emphasis: "normal", question: null, reason: "r" })),
};
function verified(surviving: SurvivingFinding[], dropped: VerifyOk["dropped"] = []): VerifyOk {
  return { ok: true, surviving, dropped, downgraded: [], claimsMade: surviving.length + dropped.length, claimsSurviving: surviving.length, trail: [], usage: { tier: "cheap", model: "fake", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, durationMs: 0 } };
}
const checks = { couldNotJudge: ["2 embedded videos/prototypes not reviewed."] };

function fakeModel(pick: (allowed: string[]) => Partial<ReportProposal>, seen: { user?: string; calls: number } = { calls: 0 }): CallModel {
  return async (call) => {
    seen.calls += 1;
    seen.user = call.user;
    const allowed = /choose the one that matters more for the target and say why: ([A-L, ]+)\./.exec(call.user)?.[1].split(", ") ?? [/Chosen by the ranking rule: ([A-L])/.exec(call.user)![1]];
    const base: ReportProposal = {
      weakest_part: { chosen_id: allowed[0] as ReportProposal["weakest_part"]["chosen_id"], plain_words: "the thing", why_weak: "because", why_it_outranks: "since" },
      one_fix: "Change X to Y this week.", one_fix_cites: [allowed[0] as "A"],
      toward_target: "To read as mid, show Z.", toward_target_cites: [allowed[0] as "A"],
      secondary: [],
      ...pick(allowed),
    };
    return { data: call.schema.parse(base), usage: { tier: call.tier, model: "fake", inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, durationMs: 1 } };
  };
}

test("ranking: the weakest part is always ★-eligible; L and K can never be chosen", () => {
  const s = allPresent().map((f) => (f.id === "L" || f.id === "K" || f.id === "F" ? sf(f.id, { verdict: "missing", emphasis: "press_hard" }) : f));
  const c = chooseWeakest(s);
  assert.equal(c.winner, null, "F, K and L are weak but none is eligible");
  assert.equal(c.tied.length, 0);
  assert.equal(c.ranking.find((r) => r.id === "L")!.excludedBecause, "not a ★ dimension");
  assert.equal(c.ranking.find((r) => r.id === "F")!.excludedBecause, "not a ★ dimension");
  assert.equal(c.ranking.find((r) => r.id === "A")!.excludedBecause, "verdict is present");
});

test("ranking: an H trust problem always wins, even against a missing, press_hard, high-confidence A", () => {
  const s = allPresent().map((f) =>
    f.id === "A" ? sf("A", { verdict: "missing", emphasis: "press_hard", confidence: "high" })
    : f.id === "H" ? sf("H", { verdict: "weak", emphasis: "light", confidence: "medium", trustIssue: true })
    : f,
  );
  const c = chooseWeakest(s);
  assert.equal(c.winner?.id, "H");
  assert.deepEqual(c.ranking.find((r) => r.id === "H")!.score, [1, 2, 1, 2]);
  assert.deepEqual(c.ranking.find((r) => r.id === "A")!.score, [0, 3, 3, 3]);
});

test("ranking: missing over weak, then emphasis, then confidence; a full tie is handed to the model", () => {
  const s1 = allPresent().map((f) => (f.id === "B" ? sf("B", { verdict: "weak", emphasis: "press_hard" }) : f.id === "C" ? sf("C", { verdict: "missing", emphasis: "light", confidence: "low" }) : f));
  assert.equal(chooseWeakest(s1).winner?.id, "C", "missing beats weak whatever the emphasis");
  const s2 = allPresent().map((f) => (f.id === "B" ? sf("B", { verdict: "weak", emphasis: "press_hard" }) : f.id === "D" ? sf("D", { verdict: "weak", emphasis: "normal", confidence: "high" }) : f));
  assert.equal(chooseWeakest(s2).winner?.id, "B", "emphasis breaks a verdict tie");
  const s3 = allPresent().map((f) => (f.id === "B" ? sf("B", { verdict: "weak", confidence: "medium" }) : f.id === "D" ? sf("D", { verdict: "weak", confidence: "high" }) : f));
  assert.equal(chooseWeakest(s3).winner?.id, "D", "confidence breaks an emphasis tie");
  const s4 = allPresent().map((f) => (f.id === "B" || f.id === "E" ? sf(f.id, { verdict: "weak" }) : f));
  const c4 = chooseWeakest(s4);
  assert.equal(c4.winner, null);
  assert.deepEqual(c4.tied.map((f) => f.id), ["B", "E"]);
});

test("a tie is broken by the model, which may only pick from the tied set", async () => {
  const s = allPresent().map((f) => (f.id === "B" || f.id === "E" ? sf(f.id, { verdict: "weak" }) : f));
  const seen = { calls: 0 } as { user?: string; calls: number };
  const result = await buildReport({ verified: verified(s), checks, classification, plan }, { callModel: fakeModel(() => ({ weakest_part: { chosen_id: "E", plain_words: "iteration", why_weak: "w", why_it_outranks: "E matters more toward mid" } }), seen) });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.report.weakest_part?.id, "E");
  assert.equal(result.tieBrokenBy, "E");
  assert.match(seen.user!, /tied these; choose the one that matters more for the target and say why: B, E\./);
});

test("a dropped finding never appears anywhere in the report, and the model never sees it", async () => {
  const s = allPresent().filter((f) => f.id !== "C").map((f) => (f.id === "A" ? sf("A", { verdict: "weak" }) : f));
  const dropped: VerifyOk["dropped"] = [{ id: "C", name: "Dim C", stage: "quote_not_found", reason: "not found", verdict: "missing", quote: "invented research quote", reasoning: "r" }];
  const seen = { calls: 0 } as { user?: string; calls: number };
  const result = await buildReport({ verified: verified(s, dropped), checks, classification, plan }, {
    callModel: fakeModel(() => ({ secondary: [{ id: "C", note: "sneaks in" }, { id: "A", note: "restates winner" }], toward_target_cites: ["C"] }), seen),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(seen.user!.includes("invented research quote"), false);
  assert.equal(seen.user!.includes("C Dim C"), false);
  const text = JSON.stringify(result.report);
  assert.equal(text.includes("sneaks in"), false);
  assert.equal(result.report.secondary.length, 0, "the winner is not repeated as secondary");
  // The model cited a dropped finding for the target sentence: replaced with the winner's own level gap.
  assert.deepEqual(result.report.reads_as.cites, ["A"]);
  assert.equal(result.report.reads_as.what_is_missing, "gap A");
  assert.equal(result.report.verification.sentence, "It made 12 claims and could verify 11 against your page; the 1 it couldn't were dropped.");
});

test("all §14 fields are present and in order, and a strong case study gets no invented weakness", async () => {
  const seen = { calls: 0 } as { user?: string; calls: number };
  const result = await buildReport({ verified: verified(allPresent()), checks, classification, plan, pipelineAssumptions: ["followed"] }, { callModel: fakeModel(() => ({}), seen) });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(seen.calls, 0, "no model call when nothing eligible is weak");
  const r = result.report;
  assert.deepEqual(Object.keys(r), ["weakest_part", "one_fix", "reads_as", "inventory", "secondary", "could_not_judge", "assumptions", "verification"]);
  assert.equal(r.weakest_part, null);
  assert.equal(r.one_fix, null);
  assert.deepEqual({ l: r.reads_as.level, c: r.reads_as.confidence, t: r.reads_as.target }, { l: "junior", c: "medium", t: "mid" });
  assert.equal(r.inventory.length, 9);
  assert.equal(r.inventory[2].part, "design decisions");
  assert.deepEqual(r.could_not_judge, [
    "A fuller version linked from this page was not read: Full case study on Behance (https://behance.net/x).",
    "2 embedded videos/prototypes not reviewed.",
    "Visual craft was not assessed in depth (v1 judges the narrative).",
  ]);
  assert.deepEqual(r.assumptions, ["Treated the page as one case study.", "No target level was given, so the review is framed toward mid, one step up from junior.", "followed"]);
  assert.equal(r.verification.sentence, "It made 12 claims and could verify all of them against your page.");
  assert.match(renderReportText(r), /^THE WEAKEST PART: none found/);
});

test("the fix always cites the weakest part, and the rendering follows the §14 order", async () => {
  const s = allPresent().map((f) => (f.id === "H" ? sf("H", { verdict: "missing", trustIssue: true }) : f.id === "D" ? sf("D", { verdict: "weak" }) : f));
  const result = await buildReport({ verified: verified(s), checks, classification, plan }, { callModel: fakeModel(() => ({ one_fix_cites: [], secondary: [{ id: "D", note: "Also: no constraint is named." }] })) });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.report.one_fix?.cites, ["H"]);
  assert.equal(result.report.weakest_part?.trust_issue, true);
  assert.deepEqual(result.report.secondary.map((x) => x.id), ["D"]);
  const text = renderReportText(result.report);
  const order = ["THE WEAKEST PART", "THE ONE FIX", "READS AS", "WHAT'S ON THE PAGE", "SECONDARY", "COULDN'T JUDGE", "ASSUMPTIONS", "HOW SURE IT IS"].map((h) => text.indexOf(h));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.ok(order.every((i) => i >= 0));
});
