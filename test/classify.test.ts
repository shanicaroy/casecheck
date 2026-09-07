/**
 * Step 2 with a stand-in model. The real model is not called here: the point
 * is to prove what the model is shown, how its answer is validated, and the
 * code-owned rule for asking vs. choosing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, decideSelection, buildUserMessage, ClassificationSchema, type Classification } from "../src/steps/classify";
import type { FetchOk } from "../src/steps/fetch";
import type { CallModel } from "../src/lib/model";

const fetched: FetchOk = {
  ok: true,
  requestedUrl: "https://example.test/work",
  finalUrl: "https://example.test/work",
  status: 200,
  title: "Work — Example",
  text: "Work\nHuddle\nA 7-week solo concept app for neighbour loneliness.\nAtlas\nRedesigning the onboarding for a B2B tool.",
  wordCount: 20,
  imageCount: 0,
  narrativeWordCount: 18,
  images: [],
  imageCandidates: 0,
  embeds: [],
  links: [
    { text: "Huddle", href: "https://example.test/work/huddle" },
    { text: "Atlas", href: "https://example.test/work/atlas" },
  ],
  fetchedAt: "2026-09-07T00:00:00.000Z",
  durationMs: 10,
};

const inventoryMissing = { status: "missing" as const, evidence: null };
const baseAnswer: Classification = {
  page_kind: "portfolio_index",
  page_kind_reason: "A work page listing two projects.",
  case_studies: [
    { title: "Huddle", url: "https://example.test/work/huddle", evidence: "A 7-week solo concept app for neighbour loneliness." },
    { title: "Atlas", url: "https://example.test/work/atlas", evidence: "Redesigning the onboarding for a B2B tool." },
  ],
  problem_type: "unclear",
  seniority: "unclear",
  seniority_confidence: "low",
  case_type: [],
  inventory: { problem: inventoryMissing, research: inventoryMissing, design_decisions: inventoryMissing, tradeoffs: inventoryMissing, constraints: inventoryMissing, role_clarity: inventoryMissing, iteration: inventoryMissing, outcome: inventoryMissing, learnings: inventoryMissing },
  external_case_study_links: [],
  assumptions: ["Treated the Work list as the list of case studies."],
  confidence: "high",
  notes: "",
};

function fakeModel(answer: Classification, seen: { user?: string; system?: string } = {}): CallModel {
  return async (call) => {
    seen.user = call.user;
    seen.system = call.system;
    return {
      data: call.schema.parse(answer),
      usage: { tier: call.tier, model: "fake", inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, durationMs: 1 },
    };
  };
}

test("the model is shown the page text, the title, and the links, under the classify prompt", async () => {
  const seen: { user?: string; system?: string } = {};
  const result = await classify(fetched, { callModel: fakeModel(baseAnswer, seen) });
  assert.equal(result.ok, true);
  assert.match(seen.user!, /<page_text>\nWork\nHuddle/);
  assert.match(seen.user!, /Title: Work — Example/);
  assert.match(seen.user!, /- Atlas → https:\/\/example\.test\/work\/atlas/);
  assert.match(seen.system!, /intake step of Case Check/);
});

test("a portfolio index with several case studies stops and asks (decision log, contract §5)", async () => {
  const result = await classify(fetched, { callModel: fakeModel(baseAnswer) });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.needsChoice, true);
  assert.equal(result.selectedIndex, null);
});

test("a single case study page selects itself; an index with one case study takes it", () => {
  assert.deepEqual(decideSelection({ ...baseAnswer, page_kind: "single_case_study", case_studies: [baseAnswer.case_studies[0]] }), { needsChoice: false, selectedIndex: 0 });
  assert.deepEqual(decideSelection({ ...baseAnswer, case_studies: [baseAnswer.case_studies[0]] }), { needsChoice: false, selectedIndex: 0 });
  assert.deepEqual(decideSelection({ ...baseAnswer, page_kind: "not_a_portfolio", case_studies: [] }), { needsChoice: false, selectedIndex: null });
});

test("long page text is cut at the limit and the step says so", () => {
  const long = { ...fetched, text: "x".repeat(70_000) };
  const { user, textTruncated } = buildUserMessage(long);
  assert.equal(textTruncated, true);
  assert.match(user, /cut at 60000 characters/);
});

test("an answer that breaks the schema is rejected, not passed on", () => {
  const bad = { ...baseAnswer, page_kind: "something_else" };
  assert.throws(() => ClassificationSchema.parse(bad));
});

test("a missing API key becomes a not_configured result, not a crash", async () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const result = await classify(fetched);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "not_configured");
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
});
