/** The run as the page sees it: an ordered stream of events. Stand-in model. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runPipeline, type RunEvent } from "../src/pipeline/run";
import type { CallModel } from "../src/lib/model";
import type { Classification } from "../src/steps/classify";
import { DIMENSION_IDS, type PlanProposal } from "../src/steps/plan";

const fixture = readFileSync(fileURLToPath(new URL("./fixtures/framer-like.html", import.meta.url)));
let server: http.Server;
let base: string;

before(async () => {
  server = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(fixture);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(() => server.close());

const present = (evidence: string) => ({ status: "present" as const, evidence });
const missing = { status: "missing" as const, evidence: null };
const singleCase: Classification = {
  page_kind: "single_case_study",
  page_kind_reason: "One case study, Huddle.",
  case_studies: [{ title: "Huddle", url: null, evidence: "A 7-week solo concept app for neighbour loneliness." }],
  problem_type: "zero_to_one",
  seniority: "junior",
  seniority_confidence: "medium",
  case_type: ["concept"],
  inventory: { problem: present("A 7-week solo concept app for neighbour loneliness."), research: missing, design_decisions: missing, tradeoffs: missing, constraints: missing, role_clarity: missing, iteration: missing, outcome: present("Weekly event turnout grew by 0%."), learnings: missing },
  external_case_study_links: [{ text: "View the full case study on Behance", href: "https://www.behance.net/gallery/123/huddle" }],
  assumptions: [],
  confidence: "medium",
  notes: "The 0% looks like an animated counter caught early.",
};
const proposal: PlanProposal = {
  summary: "The review will look hardest at whether the outcome is real, and at what was learned.",
  dimensions: DIMENSION_IDS.map((id) => ({
    id,
    emphasis: id === "H" ? "press_hard" : id === "L" ? "light" : "normal",
    question: id === "H" ? "Can a 65% turnout growth exist for a concept that was never launched?" : null,
    reason: "test",
  })),
};
// Answers whichever step is asking, judged by the prompt it was given.
const fake: CallModel = async (call) => ({
  data: call.schema.parse(/planning step/.test(call.system) ? proposal : singleCase),
  usage: { tier: call.tier, model: "fake", inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, durationMs: 1 },
});

test("fetch, classify, plan: each announced before it runs, then a run log", async () => {
  const events: RunEvent[] = [];
  for await (const e of runPipeline(`${base}/case`, {}, { callModel: fake })) events.push(e);

  const shape = events.map((e) => (e.type === "run" ? `run:${e.status}` : `${e.step}:${e.status}`));
  assert.deepEqual(shape, ["fetch:running", "fetch:done", "classify:running", "classify:done", "plan:running", "plan:done", "run:complete"]);

  const planEvent = events.find((e) => e.type === "step" && e.step === "plan" && e.status === "done");
  assert.ok(planEvent && planEvent.type === "step" && planEvent.step === "plan" && planEvent.status === "done");
  // No level stated: current inferred from classify (junior), target one step up (mid).
  assert.equal(planEvent.result.plan.levels.current, "junior");
  assert.equal(planEvent.result.plan.levels.currentSource, "inferred");
  assert.equal(planEvent.result.plan.levels.target, "mid");
  assert.equal(planEvent.result.plan.levels.targetSource, "default_next_up");

  const last = events.at(-1)!;
  assert.equal(last.type, "run");
  if (last.type !== "run") return;
  assert.equal(last.log.steps.length, 3);
  assert.equal(last.log.steps[2].step, "plan");
  assert.deepEqual(last.log.selection, { mode: "single_page", title: "Huddle" });
});

test("a stated target level passes through to the plan unchanged", async () => {
  const events: RunEvent[] = [];
  for await (const e of runPipeline(`${base}/case`, { currentLevel: "mid", targetLevel: "senior" }, { callModel: fake })) events.push(e);
  const planEvent = events.find((e) => e.type === "step" && e.step === "plan" && e.status === "done");
  assert.ok(planEvent && planEvent.type === "step" && planEvent.step === "plan" && planEvent.status === "done");
  assert.deepEqual(
    { c: planEvent.result.plan.levels.current, cs: planEvent.result.plan.levels.currentSource, t: planEvent.result.plan.levels.target, ts: planEvent.result.plan.levels.targetSource },
    { c: "mid", cs: "stated", t: "senior", ts: "stated" },
  );
});

test("a dead link stops the run after fetch", async () => {
  const events: RunEvent[] = [];
  for await (const e of runPipeline("http://127.0.0.1:9/", {}, { callModel: fake })) events.push(e);
  const shape = events.map((e) => (e.type === "run" ? `run:${e.status}` : `${e.step}:${e.status}`));
  assert.deepEqual(shape, ["fetch:running", "fetch:failed", "run:stopped"]);
});
