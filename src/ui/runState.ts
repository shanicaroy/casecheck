/**
 * What the page knows about a run, folded from the event stream one event at
 * a time. Shared by the page and the view components.
 */
import type { FetchFail } from "../steps/fetch";
import type { ClassifyResult } from "../steps/classify";
import type { PlanResult } from "../steps/plan";
import type { ChecksResult } from "../steps/checks";
import type { VerifyResult } from "../steps/verify";
import type { ReportResult } from "../steps/report";
import type { RunEvent, RunLog, FetchOkPublic, Declined } from "../pipeline/run";
import { STEP_ORDER, type StepName } from "../pipeline/steps";

export type StepState = "pending" | "running" | "done" | "failed" | "needs_choice" | "not_built";

export interface RunState {
  steps: Record<StepName, StepState>;
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

export function freshState(): RunState {
  const steps = Object.fromEntries(STEP_ORDER.map((s) => [s, "pending"])) as Record<StepName, StepState>;
  return { steps, fetch: null, classify: null, plan: null, checks: null, verify: null, report: null, declined: null, options: null, log: null, error: null };
}

/** Fold one stream event into the run state. */
export function apply(state: RunState, event: RunEvent) {
  if (event.type === "run") {
    state.log = event.log;
    if (event.status === "declined") state.declined = event.declined;
    return;
  }
  state.steps[event.step] = event.status === "running" ? "running" : event.status;
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
