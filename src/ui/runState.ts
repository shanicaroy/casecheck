/**
 * What the page knows about a run, folded from the event stream one event at
 * a time. Shared by the page and the view components.
 *
 * Besides the step results, it keeps three clocks the running view needs to
 * stay honest: when each step started, how long each finished step took, and
 * when the server last said anything (a real event or a heartbeat). Those
 * let the page tell "slow" from "stuck" without guessing.
 */
import type { FetchFail } from "../steps/fetch";
import type { ClassifyResult } from "../steps/classify";
import type { PlanResult } from "../steps/plan";
import type { ChecksResult } from "../steps/checks";
import type { VerifyResult } from "../steps/verify";
import type { ReportResult } from "../steps/report";
import type { RunEvent, RunLog, FetchOkPublic, Declined } from "../pipeline/run";
import { STEP_ORDER, type StepName } from "../pipeline/steps";

export type StepState = "pending" | "running" | "done" | "failed" | "needs_choice";

/** The route's content-free keep-alive line. */
export interface Heartbeat {
  type: "heartbeat";
  at: number;
}
export type StreamEvent = RunEvent | Heartbeat | { type: "run"; status: "stopped"; error: { reason: string; detail: string } };

export interface RunState {
  steps: Record<StepName, StepState>;
  /** Real sub-activity lines per step, in arrival order. */
  lines: Record<StepName, string[]>;
  /** Browser clock when each step last started, for its live timer. */
  startedAt: Record<StepName, number | null>;
  /** Server-measured duration of each finished step. */
  durationMs: Record<StepName, number | null>;
  /** Browser clock of the last line from the server, heartbeat included. */
  lastEventAt: number;
  /** Set once the server closes the run: complete, stopped or declined. */
  finished: "complete" | "stopped" | "declined" | null;
  fetch: FetchOkPublic | FetchFail | null;
  classify: ClassifyResult | null;
  plan: PlanResult | null;
  checks: ChecksResult | null;
  verify: VerifyResult | null;
  report: ReportResult | null;
  declined: Declined | null;
  options: { title: string; url: string | null }[] | null;
  log: RunLog | null;
  error: string | null;
}

function perStep<T>(value: () => T): Record<StepName, T> {
  return Object.fromEntries(STEP_ORDER.map((s) => [s, value()])) as Record<StepName, T>;
}

export function freshState(): RunState {
  return {
    steps: perStep<StepState>(() => "pending"),
    lines: perStep<string[]>(() => []),
    startedAt: perStep<number | null>(() => null),
    durationMs: perStep<number | null>(() => null),
    lastEventAt: Date.now(),
    finished: null,
    fetch: null, classify: null, plan: null, checks: null, verify: null, report: null,
    declined: null, options: null, log: null, error: null,
  };
}

/** Fold one stream event into the run state. */
export function apply(state: RunState, event: StreamEvent) {
  state.lastEventAt = Date.now();
  if (event.type === "heartbeat") return;
  if (event.type === "run") {
    if ("log" in event) state.log = event.log;
    if (event.status === "declined" && "declined" in event) state.declined = event.declined;
    if ("error" in event) state.error = event.error.detail;
    state.finished = event.status;
    return;
  }
  if (event.status === "note") {
    state.lines[event.step].push(event.line);
    return;
  }
  if (event.status === "running") {
    // A followed link re-runs fetch and classify: start their clocks and lines afresh.
    state.startedAt[event.step] = Date.now();
    state.durationMs[event.step] = null;
    if (state.steps[event.step] === "done") state.lines[event.step] = [];
  } else {
    state.durationMs[event.step] = event.durationMs;
  }
  state.steps[event.step] = event.status;
  if (event.step === "fetch" && event.status === "done") state.fetch = event.result;
  if (event.step === "fetch" && event.status === "failed") state.fetch = event.error;
  if (event.step === "classify" && (event.status === "done" || event.status === "needs_choice")) state.classify = event.result;
  if (event.step === "classify" && event.status === "needs_choice") state.options = event.options;
  if (event.step === "classify" && event.status === "failed") state.classify = event.error;
  if (event.step === "plan" && event.status === "done") state.plan = event.result;
  if (event.step === "plan" && event.status === "failed") state.plan = event.error;
  if (event.step === "checks" && event.status === "done") state.checks = event.result;
  if (event.step === "checks" && event.status === "failed") state.checks = event.error;
  if (event.step === "verify" && event.status === "done") state.verify = event.result;
  if (event.step === "verify" && event.status === "failed") state.verify = event.error;
  if (event.step === "report" && event.status === "done") state.report = event.result;
  if (event.step === "report" && event.status === "failed") state.report = event.error;
}
