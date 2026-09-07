/**
 * Step 5 with a stand-in model. Pass 1 is code and needs no model; pass 2
 * is one question per finding and the stand-in answers by finding id.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { verify, buildQuestion, oneLevelDown, type SurvivingFinding } from "../src/steps/verify";
import { normaliseForMatch, quoteInSource } from "../src/lib/quotes";
import type { ChecksOk, Finding } from "../src/steps/checks";
import type { FetchOk } from "../src/steps/fetch";
import type { CallModel } from "../src/lib/model";
import { DIMENSION_IDS } from "../src/steps/plan";

const source = [
  "Huddle",
  "A 7-week solo concept app for neighbour loneliness.",
  "We interviewed six neighbours — three said they'd “never” join a group event.",
  "If I were to launch, I would measure weekly event turnout.",
].join("\n");

const fetched: FetchOk = {
  ok: true, requestedUrl: "u", finalUrl: "u", status: 200, title: "Huddle", text: source, wordCount: 40, imageCount: 1, narrativeWordCount: 38,
  links: [], images: [{ index: 1, alt: "Research map", width: 600, height: 300, position: 0.4, nearbyWords: 10, mediaType: "image/jpeg", data: "IMG" }],
  imageCandidates: 1, embeds: [], fetchedAt: "t", durationMs: 1,
};

function finding(id: Finding["id"], over: Partial<Finding> = {}): Finding {
  return {
    id, name: `Dim ${id}`, star: false, emphasis: "normal", question: null, verdict: "weak",
    evidence: { kind: "quote", text: "A 7-week solo concept app for neighbour loneliness." },
    confidence: "high", confidenceReason: null, reasoning: "r", answerToQuestion: null, levelGap: null,
    eligibleAsWeakest: id !== "K" && id !== "L", status: "kept", dropReason: null, ...over,
  };
}
function checksWith(findings: Finding[]): ChecksOk {
  return { ok: true, findings, imagesRead: [], couldNotJudge: [], embedCount: 0, adjustments: [], usage: { tier: "strong", model: "fake", inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, durationMs: 1 } };
}
const allTwelve = () => DIMENSION_IDS.map((id) => finding(id));

/** Pass-2 stand-in: answers by dimension id; records what it was asked. */
function fakeModel(byId: Partial<Record<Finding["id"], { answer: string; reason: string }>>, seen: Parameters<CallModel>[0][] = []): CallModel {
  return async (call) => {
    seen.push(call);
    const id = /^Dimension ([A-L]):/.exec(call.user)![1] as Finding["id"];
    const answer = byId[id] ?? { answer: "supports", reason: "ok" };
    return { data: call.schema.parse(answer), usage: { tier: call.tier, model: "fake", inputTokens: 2, outputTokens: 1, cacheReadTokens: 0, durationMs: 1 } };
  };
}

test("quote matching survives whitespace, curly quotes and dash variants, but not changed words", () => {
  assert.equal(normaliseForMatch("  “never”   join — a  group "), '"never" join - a group');
  assert.ok(quoteInSource('three said they\'d "never" join a group event', source));
  assert.ok(quoteInSource("We interviewed six neighbours - three said", source));
  assert.ok(quoteInSource("A 7-week solo concept app\nfor neighbour loneliness.", source));
  assert.equal(quoteInSource("A seven-week solo concept app", source), false);
  assert.equal(quoteInSource("", source), false);
});

test("pass 1: a finding whose quote is not on the page is dropped by code, and the model is never asked about it", async () => {
  const seen: Parameters<CallModel>[0][] = [];
  const findings = allTwelve();
  findings[0] = finding("A", { evidence: { kind: "quote", text: "Your metrics section is strong." } });
  const result = await verify(checksWith(findings), fetched, { callModel: fakeModel({}, seen) });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.claimsMade, 12);
  assert.equal(result.claimsSurviving, 11);
  assert.deepEqual(result.dropped.map((d) => [d.id, d.stage]), [["A", "quote_not_found"]]);
  assert.equal(result.dropped[0].quote, "Your metrics section is strong.");
  assert.equal(seen.length, 11, "only pass-1 survivors reach the model");
  assert.ok(!seen.some((c) => /^Dimension A:/.test(c.user)));
  assert.ok(!result.surviving.some((f) => f.id === "A"));
});

test("pass 1: a genuine quote with altered whitespace and curly quotes still matches", async () => {
  const findings = allTwelve();
  findings[2] = finding("C", { evidence: { kind: "quote", text: "three   said they'd \"never\" join a group event" } });
  const result = await verify(checksWith(findings), fetched, { callModel: fakeModel({}) });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.claimsSurviving, 12);
  assert.ok(result.surviving.some((f) => f.id === "C"));
});

test("pass 2: does_not_support drops; partially_supports downgrades one level and notes why; low stays low", async () => {
  const findings = allTwelve();
  findings[7] = finding("H", { confidence: "high" });
  findings[8] = finding("I", { confidence: "medium", confidenceReason: "thin evidence" });
  findings[9] = finding("J", { confidence: "low", confidenceReason: "surface" });
  const result = await verify(checksWith(findings), fetched, {
    callModel: fakeModel({
      B: { answer: "does_not_support", reason: "The quote is about the concept, not about iteration." },
      H: { answer: "partially_supports", reason: "The quote is consistent but does not show a stated outcome." },
      I: { answer: "partially_supports", reason: "Goes further than the quote." },
      J: { answer: "partially_supports", reason: "Weak link." },
    }),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.claimsMade, 12);
  assert.equal(result.claimsSurviving, 11);
  assert.deepEqual(result.dropped.map((d) => [d.id, d.stage]), [["B", "does_not_support"]]);
  const h = result.surviving.find((f) => f.id === "H")!;
  assert.equal(h.confidence, "medium");
  assert.match(h.confidenceReason!, /Verification: The quote is consistent/);
  assert.equal(h.verification, "partially_supports");
  const i = result.surviving.find((f) => f.id === "I")!;
  assert.equal(i.confidence, "low");
  assert.match(i.confidenceReason!, /^thin evidence Verification:/);
  const j = result.surviving.find((f) => f.id === "J")!;
  assert.equal(j.confidence, "low");
  assert.deepEqual(result.downgraded.map((d) => [d.id, d.from, d.to]), [["H", "high", "medium"], ["I", "medium", "low"]]);
  assert.equal(oneLevelDown("low"), "low");
});

test("image-grounded findings: pass 1 checks the index; pass 2 gets the image attached; confidence stays at most medium", async () => {
  const seen: Parameters<CallModel>[0][] = [];
  const findings = allTwelve();
  findings[2] = finding("C", { evidence: { kind: "image", index: 1, note: "interview notes" }, confidence: "medium", confidenceReason: "image" });
  findings[3] = finding("D", { evidence: { kind: "image", index: 4, note: "n" }, confidence: "medium", confidenceReason: "image" });
  const result = await verify(checksWith(findings), fetched, { callModel: fakeModel({}, seen) });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.dropped.map((d) => [d.id, d.stage]), [["D", "image_not_found"]]);
  const askedC = seen.find((c) => /^Dimension C:/.test(c.user))!;
  assert.equal(askedC.images?.length, 1);
  assert.equal(askedC.images?.[0].data, "IMG");
  assert.match(askedC.user, /page image \(attached\)\. Note on what it shows: interview notes/);
  const c = result.surviving.find((f) => f.id === "C")!;
  assert.equal(c.confidence, "medium");
});

test("findings dropped in step 4 count as claims made, never reach the model, and never survive", async () => {
  const seen: Parameters<CallModel>[0][] = [];
  const findings = allTwelve();
  findings[5] = finding("F", { status: "dropped", dropReason: "No verbatim quote was given.", evidence: null });
  findings[6] = finding("G", { status: "dropped", dropReason: "The model returned no finding for this dimension.", evidence: null });
  const result = await verify(checksWith(findings), fetched, { callModel: fakeModel({}, seen) });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.claimsMade, 11, "an omitted dimension is not a claim; a quote-less one is");
  assert.equal(result.claimsSurviving, 10);
  assert.deepEqual(result.dropped.map((d) => [d.id, d.stage]), [["F", "checks"]]);
  assert.equal(seen.length, 10);
  // The surviving type has no status field and never a null evidence.
  const s: SurvivingFinding = result.surviving[0];
  assert.ok(s.evidence);
  assert.equal("status" in s, false);
});

test("the question put to the model carries the verdict, the reasoning and the exact quote", () => {
  const q = buildQuestion(finding("H", { verdict: "missing", reasoning: "No outcome is stated.", answerToQuestion: "No." }));
  assert.match(q, /^Dimension H: Dim H\nVerdict: missing\nReasoning: No outcome is stated\.\nAnswer to the planned question: No\./);
  assert.match(q, /"A 7-week solo concept app for neighbour loneliness\."/);
});

test("usage is summed over the pass-2 calls", async () => {
  const result = await verify(checksWith(allTwelve()), fetched, { callModel: fakeModel({}) });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.usage.inputTokens, 24);
  assert.equal(result.usage.outputTokens, 12);
  assert.equal(result.usage.tier, "cheap");
});
