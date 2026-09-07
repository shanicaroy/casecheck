/**
 * Step 4 with a stand-in model. Proves: every kept finding carries a quote or
 * an image; L is never eligible and always low confidence; the plan's
 * emphasis changes what the model is asked; the standing guards hold.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { runChecks, normalise, buildUserMessage, type ChecksProposal } from "../src/steps/checks";
import { DIMENSION_IDS, type Plan } from "../src/steps/plan";
import type { FetchOk } from "../src/steps/fetch";
import type { Classification } from "../src/steps/classify";
import type { CallModel } from "../src/lib/model";
import { limits } from "../config/limits";

const fetched: FetchOk = {
  ok: true,
  requestedUrl: "https://example.test/huddle",
  finalUrl: "https://example.test/huddle",
  status: 200,
  title: "Huddle",
  text: "Huddle\nA 7-week solo concept app for neighbour loneliness.\nIf I were to launch, I would measure weekly event turnout.\nWeekly event turnout grew by 0%.",
  wordCount: 30,
  imageCount: 1,
  narrativeWordCount: 28,
  links: [],
  images: [{ index: 1, alt: "Research map", width: 600, height: 300, position: 0.4, nearbyWords: 12, mediaType: "image/jpeg", data: "AAAA" }],
  imageCandidates: 3,
  embeds: [{ kind: "youtube", src: "https://www.youtube.com/embed/x" }, { kind: "loom", src: "https://loom.com/x" }],
  fetchedAt: "2026-09-07T00:00:00.000Z",
  durationMs: 10,
};
const present = (evidence: string) => ({ status: "present" as const, evidence });
const missing = { status: "missing" as const, evidence: null };
const classification: Classification = {
  page_kind: "single_case_study",
  page_kind_reason: "One case study.",
  case_studies: [{ title: "Huddle", url: null, evidence: "A 7-week solo concept app for neighbour loneliness." }],
  problem_type: "zero_to_one",
  seniority: "junior",
  seniority_confidence: "medium",
  case_type: ["concept"],
  inventory: { problem: present("A 7-week solo concept app for neighbour loneliness."), research: missing, design_decisions: missing, tradeoffs: missing, constraints: missing, role_clarity: missing, iteration: missing, outcome: present("Weekly event turnout grew by 0%."), learnings: missing },
  external_case_study_links: [],
  assumptions: [],
  confidence: "high",
  notes: "",
};
const plan: Plan = {
  levels: { current: "junior", currentSource: "inferred", target: "mid", targetSource: "default_next_up", assumptions: [] },
  summary: "We will look hardest at the outcome.",
  dimensions: DIMENSION_IDS.map((id) => ({
    id,
    name: id,
    star: "ABCDE".includes(id),
    emphasis: id === "H" ? "press_hard" : id === "L" || id === "J" ? "light" : "normal",
    question: id === "H" ? "Can an 8-week turnout curve exist for an unlaunched 7-week concept?" : null,
    reason: "r",
  })),
};

const good = (): ChecksProposal => ({
  findings: DIMENSION_IDS.map((id) => ({
    id,
    verdict: "present",
    evidence_kind: "quote",
    quote: "A 7-week solo concept app for neighbour loneliness.",
    image_index: null,
    image_note: null,
    confidence: "high",
    confidence_reason: null,
    reasoning: "r",
    answer_to_question: id === "H" ? "No." : "stray answer",
    level_gap: "stray gap",
    trust_issue: false,
  })),
  images_read: [{ index: 1, narrative_recovered: "Interviews: 5 neighbours", artefact_verified: "a research map exists" }],
  could_not_judge: ["The Behance link was not read."],
});

function fakeModel(answer: ChecksProposal, seen: { call?: Parameters<CallModel>[0] } = {}): CallModel {
  return async (call) => {
    seen.call = call;
    return { data: call.schema.parse(answer), usage: { tier: call.tier, model: "fake", inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, durationMs: 1 } };
  };
}

test("runs on the strong tier, with the checks prompt, the rubric, the page text and the images", async () => {
  const seen: { call?: Parameters<CallModel>[0] } = {};
  const result = await runChecks(fetched, classification, plan, { callModel: fakeModel(good(), seen) });
  assert.equal(result.ok, true);
  assert.equal(seen.call!.tier, "strong");
  assert.match(seen.call!.system, /check step of Case Check/);
  assert.match(seen.call!.system, /\*\*H\. Outcome and honesty ★\*\*/);
  assert.match(seen.call!.user, /<page_text>\nHuddle/);
  assert.equal(seen.call!.images!.length, 1);
  assert.match(seen.call!.images![0].label, /Image 1 of 1: alt "Research map", 40% down the page/);
  assert.equal(seen.call!.images![0].data, "AAAA");
});

test("the plan's emphasis changes what the model is asked", () => {
  const { user } = buildUserMessage(fetched, classification, plan, limits);
  // The plan fixture names each dimension by its letter, hence "H H".
  assert.match(user, /H H — press_hard\. Answer explicitly: Can an 8-week turnout curve exist for an unlaunched 7-week concept\?/);
  assert.match(user, /J J — light: one sentence\./);
  assert.match(user, /A ★ A — normal\./);
  assert.match(user, /Target level: mid \(assumed: one step up\)/);
  assert.match(user, /not_on_this_page is not available for this page/);
  assert.match(user, /2 embedded item\(s\) detected and not analysed: youtube, loom/);
});

test("every kept finding carries a quote or an image; twelve in order; emphasis and question copied from the plan", async () => {
  const result = await runChecks(fetched, classification, plan, { callModel: fakeModel(good()) });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.findings.map((f) => f.id), DIMENSION_IDS);
  for (const f of result.findings) {
    assert.equal(f.status, "kept");
    assert.ok(f.evidence, `${f.id} has evidence`);
  }
  const h = result.findings[7];
  assert.equal(h.emphasis, "press_hard");
  assert.match(h.question!, /8-week turnout/);
  assert.equal(h.answerToQuestion, "No.");
  // An answer on a non-press_hard dimension is discarded; a level gap on a present verdict too.
  assert.equal(result.findings[0].answerToQuestion, null);
  assert.equal(result.findings[0].levelGap, null);
});

test("no quote, no finding: an empty quote or a bad image index drops the finding but keeps its place", () => {
  const p = good();
  p.findings[0].quote = "   ";
  p.findings[1] = { ...p.findings[1], evidence_kind: "image", quote: null, image_index: 7, image_note: "n" };
  const { findings, adjustments } = normalise(p, plan, 1, false);
  assert.equal(findings.length, 12);
  assert.equal(findings[0].status, "dropped");
  assert.equal(findings[0].evidence, null);
  assert.match(findings[0].dropReason!, /No verbatim quote/);
  assert.equal(findings[1].status, "dropped");
  assert.match(findings[1].dropReason!, /Image 7 does not exist; 1 image was captured/);
  assert.match(adjustments.join("\n"), /Finding A dropped/);
});

test("a finding the model omits is recorded as dropped, not invented", () => {
  const p = good();
  p.findings = p.findings.filter((f) => f.id !== "G");
  const { findings } = normalise(p, plan, 1, false);
  assert.equal(findings[6].id, "G");
  assert.equal(findings[6].status, "dropped");
  assert.equal(findings[6].evidence, null);
});

test("only the ★ dimensions A–E and H are eligible; L is always low confidence", () => {
  const { findings } = normalise(good(), plan, 1, false);
  const l = findings[11];
  assert.equal(l.id, "L");
  assert.equal(l.confidence, "low");
  assert.deepEqual(findings.filter((f) => f.eligibleAsWeakest).map((f) => f.id), ["A", "B", "C", "D", "E", "H"]);
});

test("trust_issue is only honoured on H with a weak or missing verdict", () => {
  const p = good();
  p.findings[0].trust_issue = true;                                    // A: cleared
  p.findings[7] = { ...p.findings[7], trust_issue: true };             // H present: cleared
  const first = normalise(p, plan, 1, false);
  assert.equal(first.findings[0].trustIssue, false);
  assert.equal(first.findings[7].trustIssue, false);
  assert.match(first.adjustments.join("\n"), /only H may raise/);
  p.findings[7] = { ...p.findings[7], verdict: "weak", trust_issue: true };
  const second = normalise(p, plan, 1, false);
  assert.equal(second.findings[7].trustIssue, true);
});

test("an image-grounded finding is capped at medium confidence", () => {
  const p = good();
  p.findings[2] = { ...p.findings[2], evidence_kind: "image", quote: null, image_index: 1, image_note: "shows interview notes", confidence: "high" };
  const { findings, adjustments } = normalise(p, plan, 1, false);
  assert.deepEqual(findings[2].evidence, { kind: "image", index: 1, note: "shows interview notes" });
  assert.equal(findings[2].confidence, "medium");
  assert.match(adjustments.join("\n"), /Finding C rests on an image; confidence capped at medium/);
});

test("not_on_this_page is only available when a fuller version elsewhere was found", () => {
  const p = good();
  p.findings[2].verdict = "not_on_this_page";
  const without = normalise(p, plan, 1, false);
  assert.equal(without.findings[2].verdict, "missing");
  assert.match(without.adjustments.join("\n"), /changed to missing/);
  const withLink = normalise(p, plan, 1, true);
  assert.equal(withLink.findings[2].verdict, "not_on_this_page");
});

test("embedded media and images beyond the cap are added to couldn't judge by code", async () => {
  const result = await runChecks(fetched, classification, plan, { callModel: fakeModel(good()) });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.embedCount, 2);
  assert.deepEqual(result.couldNotJudge, [
    "The Behance link was not read.",
    "2 embedded videos/prototypes not reviewed.",
    "2 further page images beyond the cap of 8 not read.",
  ]);
});

test("a missing API key becomes a not_configured result", async () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const result = await runChecks(fetched, classification, plan);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "not_configured");
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
});
