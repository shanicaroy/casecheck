/**
 * The six-step run, as an async generator that yields one event per step
 * transition. The web route streams these events to the page as they happen
 * (contract §7: steps stream as they complete, no blank spinner). The CLI
 * prints them. Neither knows anything about the steps themselves.
 *
 * Built so far: fetch → classify. Later slices append steps here.
 */
import { randomUUID } from "node:crypto";
import { fetchPage, type FetchOk, type FetchFail } from "../steps/fetch";
import { classify, type ClassifyOk, type ClassifyFail } from "../steps/classify";
import type { CallModel, ModelUsage } from "../lib/model";

import type { StepName } from "./steps";
export type { StepName } from "./steps";

export interface StepLogEntry {
  step: StepName;
  durationMs: number;
  usage?: ModelUsage;
}

/** Eval sheet §7: the fields collected automatically per run. */
export interface RunLog {
  runId: string;
  startedAt: string;
  inputUrl: string;
  steps: StepLogEntry[];
  totalMs: number;
  /** Which case study was selected and whether the tool asked or assumed. */
  selection: { mode: "single_page" | "assumed_only_one" | "asked" | "none"; title: string | null } | null;
}

export type RunEvent =
  | { type: "step"; step: StepName; status: "running" }
  | { type: "step"; step: "fetch"; status: "done"; result: FetchOk; durationMs: number }
  | { type: "step"; step: "fetch"; status: "failed"; error: FetchFail; durationMs: number }
  | { type: "step"; step: "classify"; status: "done"; result: ClassifyOk; durationMs: number }
  | { type: "step"; step: "classify"; status: "needs_choice"; result: ClassifyOk; options: { title: string; url: string | null }[]; durationMs: number }
  | { type: "step"; step: "classify"; status: "failed"; error: ClassifyFail; durationMs: number }
  | { type: "run"; status: "stopped" | "complete"; log: RunLog };

export interface RunDeps {
  callModel?: CallModel;
}

export async function* runPipeline(url: string, deps: RunDeps = {}): AsyncGenerator<RunEvent> {
  const started = Date.now();
  const log: RunLog = {
    runId: randomUUID(),
    startedAt: new Date(started).toISOString(),
    inputUrl: url,
    steps: [],
    totalMs: 0,
    selection: null,
  };
  const finish = (status: "stopped" | "complete"): RunEvent => {
    log.totalMs = Date.now() - started;
    return { type: "run", status, log };
  };

  // 1. Fetch
  yield { type: "step", step: "fetch", status: "running" };
  const fetched = await fetchPage(url);
  log.steps.push({ step: "fetch", durationMs: fetched.durationMs });
  if (!fetched.ok) {
    yield { type: "step", step: "fetch", status: "failed", error: fetched, durationMs: fetched.durationMs };
    yield finish("stopped");
    return;
  }
  yield { type: "step", step: "fetch", status: "done", result: fetched, durationMs: fetched.durationMs };

  // 2. Classify
  yield { type: "step", step: "classify", status: "running" };
  const t2 = Date.now();
  const classified = await classify(fetched, { callModel: deps.callModel });
  const ms2 = Date.now() - t2;
  if (!classified.ok) {
    log.steps.push({ step: "classify", durationMs: ms2 });
    yield { type: "step", step: "classify", status: "failed", error: classified, durationMs: ms2 };
    yield finish("stopped");
    return;
  }
  log.steps.push({ step: "classify", durationMs: ms2, usage: classified.usage });

  const c = classified.classification;
  if (classified.needsChoice) {
    log.selection = { mode: "asked", title: null };
    yield {
      type: "step",
      step: "classify",
      status: "needs_choice",
      result: classified,
      options: c.case_studies.map((cs) => ({ title: cs.title, url: cs.url })),
      durationMs: ms2,
    };
    yield finish("stopped");
    return;
  }
  const chosen = classified.selectedIndex !== null ? c.case_studies[classified.selectedIndex] : null;
  log.selection = {
    mode: chosen ? (c.page_kind === "single_case_study" ? "single_page" : "assumed_only_one") : "none",
    title: chosen?.title ?? null,
  };
  yield { type: "step", step: "classify", status: "done", result: classified, durationMs: ms2 };

  // Steps 3–6 arrive in later slices.
  yield finish("complete");
}
