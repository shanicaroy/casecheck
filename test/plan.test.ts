/** Step 3 with a stand-in model: what it is shown, and the rules code enforces on its answer. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { plan, normalise, buildUserMessage, DIMENSION_IDS, type PlanProposal } from "../src/steps/plan";
import { resolveLevels, nextLevelUp } from "../src/lib/levels";
import type { Classification } from "../src/steps/classify";
import type { CallModel } from "../src/lib/model";

const present = (evidence: string) => ({ status: "present" as const, evidence });
const missing = { status: "missing" as const, evidence: null };
const revamp: Classification = {
  page_kind: "single_case_study",
  page_kind_reason: "One case study.",
  case_studies: [{ title: "FX Online", url: null, evidence: "Redesigning the FX trading dashboard." }],
  problem_type: "revamp",
  seniority: "mid",
  seniority_confidence: "medium",
  case_type: ["product_design", "shipped"],
  inventory: {
    problem: present("Redesigning the FX trading dashboard."),
    research: present("We interviewed six traders."),
    design_decisions: missing, tradeoffs: missing, constraints: missing, role_clarity: missing,
    iteration: { status: "weak", evidence: "We tested the new version against the old." },
    outcome: present("Task completion rose 18%."),
    learnings: missing,
  },
  external_case_study_links: [],
  assumptions: [],
  confidence: "high",
  notes: "",
};

const allNormal = (): PlanProposal => ({
  summary: "s",
  dimensions: DIMENSION_IDS.map((id) => ({ id, emphasis: "normal", question: null, reason: "r" })),
});

function fakeModel(answer: PlanProposal, seen: { user?: string; system?: string } = {}): CallModel {
  return async (call) => {
    seen.user = call.user;
    seen.system = call.system;
    return { data: call.schema.parse(answer), usage: { tier: call.tier, model: "fake", inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, durationMs: 1 } };
  };
}

test("levels: stated wins; otherwise inferred, target one step up; unclear is assumed junior and written down", () => {
  assert.equal(nextLevelUp("student"), "junior");
  assert.equal(nextLevelUp("senior"), "senior");
  const a = resolveLevels({}, "mid");
  assert.deepEqual([a.current, a.currentSource, a.target, a.targetSource], ["mid", "inferred", "senior", "default_next_up"]);
  assert.equal(a.assumptions.length, 1);
  const b = resolveLevels({ currentLevel: "junior", targetLevel: "senior" }, "mid");
  assert.deepEqual([b.current, b.currentSource, b.target, b.targetSource, b.assumptions.length], ["junior", "stated", "senior", "stated", 0]);
  const c = resolveLevels({}, "unclear");
  assert.deepEqual([c.current, c.currentSource, c.target], ["junior", "assumed", "mid"]);
  assert.equal(c.assumptions.length, 2);
});

test("the model is shown the classification, the levels, the plan prompt and the rubric", async () => {
  const seen: { user?: string; system?: string } = {};
  const result = await plan(revamp, { targetLevel: "senior" }, { callModel: fakeModel(allNormal(), seen) });
  assert.equal(result.ok, true);
  assert.match(seen.user!, /Problem type: revamp/);
  assert.match(seen.user!, /- research: present — "We interviewed six traders."/);
  assert.match(seen.user!, /Target level: senior \(stated by the designer\)/);
  assert.match(seen.system!, /planning step of Case Check/);
  assert.match(seen.system!, /\*\*A\. Problem framing ★\*\*/);
});

test("the plan always has twelve dimensions in rubric order", () => {
  const { dimensions } = normalise(allNormal());
  assert.deepEqual(dimensions.map((d) => d.id), DIMENSION_IDS);
  assert.equal(dimensions[0].name, "Problem framing");
  assert.equal(dimensions[0].star, true);
  assert.equal(dimensions[11].star, false);
});

test("L is always light, whatever the model proposed", () => {
  const p = allNormal();
  p.dimensions[11] = { id: "L", emphasis: "press_hard", question: "Is the UI polished?", reason: "r" };
  const { dimensions, adjustments } = normalise(p);
  assert.equal(dimensions[11].emphasis, "light");
  assert.equal(dimensions[11].question, null);
  assert.match(adjustments.join("\n"), /Dimension L is always light/);
});

test("press_hard without a question is downgraded; a question on a normal dimension is dropped", () => {
  const p = allNormal();
  p.dimensions[0] = { id: "A", emphasis: "press_hard", question: null, reason: "r" };
  p.dimensions[1] = { id: "B", emphasis: "normal", question: "stray", reason: "r" };
  p.dimensions[2] = { id: "C", emphasis: "press_hard", question: "Which decision did the six interviews change?", reason: "r" };
  const { dimensions, adjustments } = normalise(p);
  assert.equal(dimensions[0].emphasis, "normal");
  assert.equal(dimensions[1].question, null);
  assert.equal(dimensions[2].emphasis, "press_hard");
  assert.equal(dimensions[2].question, "Which decision did the six interviews change?");
  assert.match(adjustments.join("\n"), /Dimension A was press_hard without a question/);
});

test("a missing dimension is filled at normal and a duplicate is ignored, both recorded", () => {
  const p = allNormal();
  p.dimensions = p.dimensions.filter((d) => d.id !== "G");
  p.dimensions.push({ id: "A", emphasis: "light", question: null, reason: "dup" });
  const { dimensions, adjustments } = normalise(p);
  assert.equal(dimensions.length, 12);
  assert.equal(dimensions[6].id, "G");
  assert.equal(dimensions[6].emphasis, "normal");
  assert.equal(dimensions[0].emphasis, "normal");
  assert.match(adjustments.join("\n"), /Dimension G was missing/);
  assert.match(adjustments.join("\n"), /Dimension A was proposed twice/);
});

test("buildUserMessage names the case and the inventory quotes", () => {
  const levels = resolveLevels({}, "mid");
  const msg = buildUserMessage(revamp, levels);
  assert.match(msg, /Case study: FX Online/);
  assert.match(msg, /- iteration: weak — "We tested the new version against the old."/);
  assert.match(msg, /Current level: mid \(inferred\)/);
});
