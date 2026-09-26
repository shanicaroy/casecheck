/** The paste fallback (contract §5) and the running view's clocks. Stand-in model, no browser needed. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { runPipeline, type RunEvent } from "../src/pipeline/run";
import { fromPasted, PASTED_SOURCE } from "../src/steps/pasted";
import { freshState, apply } from "../src/ui/runState";
import type { CallModel } from "../src/lib/model";
import type { Classification } from "../src/steps/classify";
import { DIMENSION_IDS, type PlanProposal } from "../src/steps/plan";
import type { ChecksProposal } from "../src/steps/checks";

const PROBLEM = "Nurses swap shifts through a WhatsApp group of 200 people.";
const OUTCOME = "Relay reduced missed shifts by 40% in its first month.";
const pasted = [
  "Relay, a shift-swap app for nurses",
  "",
  "The problem",
  PROBLEM,
  PROBLEM, // a builder-style duplicate: must be removed
  "Impact",
  OUTCOME,
  ...Array.from({ length: 30 }, (_, i) => `Filler line ${i} with a few more words in it.`),
].join("\n");

const present = (evidence: string) => ({ status: "present" as const, evidence });
const missing = { status: "missing" as const, evidence: null };
const classification: Classification = {
  // An index whose only case study lives at another URL: a link run would follow it, a pasted run must not.
  page_kind: "portfolio_index",
  page_kind_reason: "An index with one case study, Relay.",
  case_studies: [{ title: "Relay", url: "https://elsewhere.example/relay", evidence: PROBLEM }],
  problem_type: "zero_to_one",
  seniority: "junior",
  seniority_confidence: "medium",
  case_type: ["concept"],
  inventory: { problem: present(PROBLEM), research: missing, design_decisions: missing, tradeoffs: missing, constraints: missing, role_clarity: missing, iteration: missing, outcome: present(OUTCOME), learnings: missing },
  external_case_study_links: [],
  assumptions: [],
  confidence: "medium",
  notes: "",
};
const planAnswer: PlanProposal = {
  summary: "Look hardest at the outcome.",
  dimensions: DIMENSION_IDS.map((id) => ({ id, emphasis: id === "H" ? "press_hard" : id === "L" ? "light" : "normal", question: null, reason: "test" })),
};
const checksAnswer: ChecksProposal = {
  findings: DIMENSION_IDS.map((id) => ({
    id,
    verdict: id === "H" ? "weak" : "present",
    evidence_kind: "quote",
    quote: id === "H" ? OUTCOME : PROBLEM,
    image_index: null,
    image_note: null,
    confidence: id === "L" ? "low" : "high",
    confidence_reason: id === "L" ? "surface only" : null,
    reasoning: "test",
    answer_to_question: null,
    level_gap: null,
    trust_issue: false,
  })),
  images_read: [],
  could_not_judge: [],
};
const fake: CallModel = async (call) => {
  const answer = /planning step/.test(call.system)
    ? planAnswer
    : /check step/.test(call.system)
      ? checksAnswer
      : /verification step/.test(call.system)
        ? { answer: "supports", reason: "The quote shows it." }
        : /report step/.test(call.system)
          ? {
              weakest_part: { chosen_id: "H", headline: "The outcome can't have happened yet.", why_weak: "w", why_it_matters: "m", why_it_outranks: "o" },
              one_fix: "Replace the 40% with what you tested.",
              one_fix_detail: "d",
              one_fix_cites: ["H"],
              toward_target: "To read as mid, show a real test.",
              toward_target_cites: ["H"],
              secondary: [],
            }
          : classification;
  return { data: call.schema.parse(answer), usage: { tier: call.tier, model: "fake", inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, durationMs: 1 } };
};

test("pasted text becomes the same shape the fetch step produces, de-duplicated", () => {
  const f = fromPasted({ text: pasted, images: [{ data: "AAAA", width: 800, height: 600 }] }, 8);
  assert.equal(f.ok, true);
  assert.equal(f.finalUrl, PASTED_SOURCE);
  assert.equal(f.title, "Relay, a shift-swap app for nurses");
  assert.equal(f.text.split("\n").filter((l) => l === PROBLEM).length, 1);
  assert.equal(f.narrativeWordCount, f.wordCount);
  assert.deepEqual(f.links, []);
  assert.equal(f.images.length, 1);
  assert.equal(f.images[0].index, 1);
  assert.equal(f.images[0].alt, "Screenshot 1");
});

test("the screenshot cap is honoured", () => {
  const shot = { data: "AAAA", width: 10, height: 10 };
  const f = fromPasted({ text: "x", images: Array.from({ length: 12 }, () => shot) }, 8);
  assert.equal(f.images.length, 8);
});

test("a pasted run goes through all six steps, verifies quotes against the pasted text, and never follows a link", async () => {
  const events: RunEvent[] = [];
  for await (const e of runPipeline(PASTED_SOURCE, { pasted: { text: pasted } }, { callModel: fake })) events.push(e);
  const shape = events.filter((e) => !(e.type === "step" && e.status === "note")).map((e) => (e.type === "run" ? `run:${e.status}` : `${e.step}:${e.status}`));
  assert.deepEqual(shape, ["fetch:running", "fetch:done", "classify:running", "classify:done", "plan:running", "plan:done", "checks:running", "checks:done", "verify:running", "verify:done", "report:running", "report:done", "run:complete"]);
  assert.ok(events.some((e) => e.type === "step" && e.status === "note" && /Pasted text received/.test(e.line)));
  const verify = events.find((e) => e.type === "step" && e.step === "verify" && e.status === "done");
  assert.ok(verify && verify.type === "step" && verify.step === "verify" && verify.status === "done");
  assert.equal(verify.result.claimsSurviving, 12);
  const last = events.at(-1)!;
  assert.ok(last.type === "run" && "log" in last);
  assert.equal(last.log.followedTo, null);
  assert.equal(last.log.inputUrl, PASTED_SOURCE);
});

test("pasted text under the thin floor is declined before any strong-model call", async () => {
  let strongCalls = 0;
  const counting: CallModel = async (call) => {
    if (/check step/.test(call.system)) strongCalls++;
    return fake(call);
  };
  const events: RunEvent[] = [];
  for await (const e of runPipeline(PASTED_SOURCE, { pasted: { text: "Relay\nToo short to judge." } }, { callModel: counting })) events.push(e);
  const last = events.at(-1)!;
  assert.ok(last.type === "run" && last.status === "declined");
  assert.equal(strongCalls, 0);
});

test("the page state: heartbeats keep the clock fresh without touching steps; each step keeps its own timer", () => {
  const s = freshState();
  s.lastEventAt = 0;
  apply(s, { type: "heartbeat", at: 1 });
  assert.ok(s.lastEventAt > 0);
  assert.equal(s.steps.fetch, "pending");

  apply(s, { type: "step", step: "fetch", status: "running" });
  assert.equal(s.steps.fetch, "running");
  assert.ok(s.startedAt.fetch !== null);
  assert.equal(s.durationMs.fetch, null);

  apply(s, { type: "step", step: "fetch", status: "note", line: "Page captured" });
  assert.deepEqual(s.lines.fetch, ["Page captured"]);

  const f = fromPasted({ text: pasted }, 8);
  const { images: _images, ...rest } = f;
  apply(s, { type: "step", step: "fetch", status: "done", result: { ...rest, images: [] }, durationMs: 4200 });
  assert.equal(s.durationMs.fetch, 4200);

  // A followed link runs fetch again: its lines and timer start afresh.
  apply(s, { type: "step", step: "fetch", status: "running" });
  assert.deepEqual(s.lines.fetch, []);
  assert.equal(s.durationMs.fetch, null);
});
