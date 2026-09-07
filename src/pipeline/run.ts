/**
 * The six-step run, as an async generator that yields one event per step
 * transition. The web route streams these events to the page as they happen
 * (contract §7: steps stream as they complete, no blank spinner). The CLI
 * prints them. Neither knows anything about the steps themselves.
 *
 * All six steps: fetch → classify → plan → checks → verify → report.
 *
 * Two boundaries live here, not in any step:
 *  - the too-thin floor (contract §5): below limits.thinFloorWords of real
 *    narrative the run declines with a reason, before any strong-model call;
 *  - following: when the classify step selects the only case study on an
 *    index page and it lives at another URL, that page is fetched and
 *    classified in its place (one hop), and the log says so.
 */
import { randomUUID } from "node:crypto";
import { fetchPage, type FetchOk, type FetchFail } from "../steps/fetch";
import { classify, type ClassifyOk, type ClassifyFail } from "../steps/classify";
import { plan as planChecks, type PlanOk, type PlanFail } from "../steps/plan";
import { runChecks, type ChecksOk, type ChecksFail } from "../steps/checks";
import { verify, type VerifyOk, type VerifyFail } from "../steps/verify";
import { buildReport, type ReportOk, type ReportFail } from "../steps/report";
import type { CallModel, ModelUsage } from "../lib/model";
import type { LevelInputs } from "../lib/levels";
import { activity } from "../../content/activity";
import { limits as defaultLimits, type Limits } from "../../config/limits";

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
  /** Set when the run followed an index page to its only case study. */
  followedTo: string | null;
  /** Narrative words on the reviewed page, judged against the thin floor. */
  narrativeWordCount: number | null;
  /** Eval sheet §7: the hallucination metric. */
  claims: { made: number; surviving: number } | null;
}

/** The fetch result as sent to the browser: image bytes removed (§9, §14). */
export type FetchOkPublic = Omit<FetchOk, "images"> & { images: Omit<FetchOk["images"][number], "data">[] };
function publicFetch(f: FetchOk): FetchOkPublic {
  return { ...f, images: f.images.map(({ data: _data, ...rest }) => rest) };
}

/** Contract §5 refusals decided by the pipeline. The wording shown is in content/copy.ts. */
export interface Declined {
  reason: "too_thin";
  detail: string;
  narrativeWordCount: number;
  floor: number;
}

export type RunEvent =
  | { type: "step"; step: StepName; status: "running" }
  /** A real sub-activity line for the running view. Never simulated. */
  | { type: "step"; step: StepName; status: "note"; line: string }
  | { type: "step"; step: "fetch"; status: "done"; result: FetchOkPublic; durationMs: number }
  | { type: "step"; step: "fetch"; status: "failed"; error: FetchFail; durationMs: number }
  | { type: "step"; step: "classify"; status: "done"; result: ClassifyOk; durationMs: number }
  | { type: "step"; step: "classify"; status: "needs_choice"; result: ClassifyOk; options: { title: string; url: string | null }[]; durationMs: number }
  | { type: "step"; step: "classify"; status: "failed"; error: ClassifyFail; durationMs: number }
  | { type: "step"; step: "plan"; status: "done"; result: PlanOk; durationMs: number }
  | { type: "step"; step: "plan"; status: "failed"; error: PlanFail; durationMs: number }
  | { type: "step"; step: "checks"; status: "done"; result: ChecksOk; durationMs: number }
  | { type: "step"; step: "checks"; status: "failed"; error: ChecksFail; durationMs: number }
  | { type: "step"; step: "verify"; status: "done"; result: VerifyOk; durationMs: number }
  | { type: "step"; step: "verify"; status: "failed"; error: VerifyFail; durationMs: number }
  | { type: "step"; step: "report"; status: "done"; result: ReportOk; durationMs: number }
  | { type: "step"; step: "report"; status: "failed"; error: ReportFail; durationMs: number }
  | { type: "run"; status: "declined"; declined: Declined; log: RunLog }
  | { type: "run"; status: "stopped" | "complete"; log: RunLog };

export interface RunOptions extends LevelInputs {}

export interface RunDeps {
  callModel?: CallModel;
  limits?: Partial<Limits>;
}

export async function* runPipeline(url: string, options: RunOptions = {}, deps: RunDeps = {}): AsyncGenerator<RunEvent> {
  const started = Date.now();
  const log: RunLog = {
    runId: randomUUID(),
    startedAt: new Date(started).toISOString(),
    inputUrl: url,
    steps: [],
    totalMs: 0,
    selection: null,
    followedTo: null,
    narrativeWordCount: null,
    claims: null,
  };
  const lim = { ...defaultLimits, ...deps.limits };
  const finish = (status: "stopped" | "complete"): RunEvent => {
    log.totalMs = Date.now() - started;
    return { type: "run", status, log };
  };

  // 1. Fetch
  yield { type: "step", step: "fetch", status: "running" };
  let fetched = await fetchPage(url, { limits: lim });
  log.steps.push({ step: "fetch", durationMs: fetched.durationMs });
  if (!fetched.ok) {
    yield { type: "step", step: "fetch", status: "failed", error: fetched, durationMs: fetched.durationMs };
    yield finish("stopped");
    return;
  }
  yield { type: "step", step: "fetch", status: "note", line: activity.fetch.captured(fetched.narrativeWordCount) };
  yield { type: "step", step: "fetch", status: "note", line: activity.fetch.found(fetched.links.length, fetched.imageCandidates, fetched.embeds.length) };
  yield { type: "step", step: "fetch", status: "done", result: publicFetch(fetched), durationMs: fetched.durationMs };

  // 2. Classify
  yield { type: "step", step: "classify", status: "running" };
  const t2 = Date.now();
  let classified = await classify(fetched, { callModel: deps.callModel });
  let ms2 = Date.now() - t2;
  if (!classified.ok) {
    log.steps.push({ step: "classify", durationMs: ms2 });
    yield { type: "step", step: "classify", status: "failed", error: classified, durationMs: ms2 };
    yield finish("stopped");
    return;
  }
  log.steps.push({ step: "classify", durationMs: ms2, usage: classified.usage });

  // Follow an index page to its only case study when that lives elsewhere (one hop).
  if (
    classified.classification.page_kind === "portfolio_index" &&
    classified.selectedIndex !== null &&
    classified.classification.case_studies[classified.selectedIndex]?.url &&
    classified.classification.case_studies[classified.selectedIndex]!.url !== fetched.finalUrl
  ) {
    const target = classified.classification.case_studies[classified.selectedIndex]!.url!;
    log.followedTo = target;
    yield { type: "step", step: "fetch", status: "running" };
    yield { type: "step", step: "fetch", status: "note", line: activity.fetch.following(safeHost(target)) };
    const followed = await fetchPage(target, { limits: lim });
    log.steps.push({ step: "fetch", durationMs: followed.durationMs });
    if (!followed.ok) {
      yield { type: "step", step: "fetch", status: "failed", error: followed, durationMs: followed.durationMs };
      yield finish("stopped");
      return;
    }
    fetched = followed;
    yield { type: "step", step: "fetch", status: "note", line: activity.fetch.captured(fetched.narrativeWordCount) };
    yield { type: "step", step: "fetch", status: "done", result: publicFetch(fetched), durationMs: fetched.durationMs };
    yield { type: "step", step: "classify", status: "running" };
    const t2b = Date.now();
    const again = await classify(fetched, { callModel: deps.callModel });
    ms2 = Date.now() - t2b;
    if (!again.ok) {
      log.steps.push({ step: "classify", durationMs: ms2 });
      yield { type: "step", step: "classify", status: "failed", error: again, durationMs: ms2 };
      yield finish("stopped");
      return;
    }
    log.steps.push({ step: "classify", durationMs: ms2, usage: again.usage });
    classified = again;
  }

  const c = classified.classification;
  if (classified.needsChoice) {
    log.selection = { mode: "asked", title: null };
    yield { type: "step", step: "classify", status: "note", line: activity.classify.several(c.case_studies.length) };
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
  if (chosen) {
    const parts = Object.values(c.inventory);
    yield { type: "step", step: "classify", status: "note", line: activity.classify.caseStudy(chosen.title) };
    yield { type: "step", step: "classify", status: "note", line: activity.classify.shape(c.problem_type, parts.filter((i) => i.status === "present").length, parts.length) };
  } else {
    yield { type: "step", step: "classify", status: "note", line: activity.classify.nothing };
  }
  yield { type: "step", step: "classify", status: "done", result: classified, durationMs: ms2 };

  // Nothing to review (not a portfolio, too little content): stop here.
  // The designed refusal message for this case is a later slice.
  if (!chosen) {
    yield finish("stopped");
    return;
  }

  // Too-thin floor (§5), judged before any strong-model call is made.
  log.narrativeWordCount = fetched.narrativeWordCount;
  if (fetched.narrativeWordCount < lim.thinFloorWords) {
    log.totalMs = Date.now() - started;
    yield {
      type: "run",
      status: "declined",
      declined: {
        reason: "too_thin",
        detail: `${fetched.narrativeWordCount} words of case-study narrative found on this page; the floor is ${lim.thinFloorWords}.`,
        narrativeWordCount: fetched.narrativeWordCount,
        floor: lim.thinFloorWords,
      },
      log,
    };
    return;
  }

  // 3. Plan — shown before the checks run (contract §7).
  yield { type: "step", step: "plan", status: "running" };
  const t3 = Date.now();
  const planned = await planChecks(c, { currentLevel: options.currentLevel, targetLevel: options.targetLevel }, { callModel: deps.callModel });
  const ms3 = Date.now() - t3;
  if (!planned.ok) {
    log.steps.push({ step: "plan", durationMs: ms3 });
    yield { type: "step", step: "plan", status: "failed", error: planned, durationMs: ms3 };
    yield finish("stopped");
    return;
  }
  log.steps.push({ step: "plan", durationMs: ms3, usage: planned.usage });
  yield { type: "step", step: "plan", status: "note", line: activity.plan.pressing(planned.plan.dimensions.filter((d) => d.emphasis === "press_hard").map((d) => d.name)) };
  yield { type: "step", step: "plan", status: "done", result: planned, durationMs: ms3 };

  // 4. Run checks — strong model, with the captured images.
  yield { type: "step", step: "checks", status: "running" };
  if (fetched.images.length > 0) {
    yield { type: "step", step: "checks", status: "note", line: activity.checks.images(fetched.images.length, fetched.imageCandidates) };
  }
  const t4 = Date.now();
  const checked = await runChecks(fetched, c, planned.plan, { callModel: deps.callModel, limits: lim });
  const ms4 = Date.now() - t4;
  if (!checked.ok) {
    log.steps.push({ step: "checks", durationMs: ms4 });
    yield { type: "step", step: "checks", status: "failed", error: checked, durationMs: ms4 };
    yield finish("stopped");
    return;
  }
  log.steps.push({ step: "checks", durationMs: ms4, usage: checked.usage });
  yield { type: "step", step: "checks", status: "note", line: activity.checks.findings(checked.findings.filter((f) => f.status === "kept").length) };
  yield { type: "step", step: "checks", status: "done", result: checked, durationMs: ms4 };

  // 5. Self-verify — code first, then the cheap model once per surviving finding.
  yield { type: "step", step: "verify", status: "running" };
  const t5 = Date.now();
  const verified = await verify(checked, fetched, { callModel: deps.callModel });
  const ms5 = Date.now() - t5;
  if (!verified.ok) {
    log.steps.push({ step: "verify", durationMs: ms5 });
    yield { type: "step", step: "verify", status: "failed", error: verified, durationMs: ms5 };
    yield finish("stopped");
    return;
  }
  log.steps.push({ step: "verify", durationMs: ms5, usage: verified.usage });
  log.claims = { made: verified.claimsMade, surviving: verified.claimsSurviving };
  yield { type: "step", step: "verify", status: "note", line: activity.verify.counts(verified.claimsMade, verified.claimsSurviving) };
  yield { type: "step", step: "verify", status: "done", result: verified, durationMs: ms5 };

  // 6. Report — from surviving findings only.
  yield { type: "step", step: "report", status: "running" };
  const t6 = Date.now();
  const pipelineAssumptions: string[] = [];
  if (log.followedTo) pipelineAssumptions.push(`The link was a portfolio page with one case study, so the review ran on that case study's page: ${log.followedTo}.`);
  if (log.selection?.mode === "assumed_only_one") pipelineAssumptions.push("Only one case study was found, so it was reviewed without asking.");
  const reported = await buildReport({ verified, checks: checked, classification: c, plan: planned.plan, pipelineAssumptions }, { callModel: deps.callModel });
  const ms6 = Date.now() - t6;
  if (!reported.ok) {
    log.steps.push({ step: "report", durationMs: ms6 });
    yield { type: "step", step: "report", status: "failed", error: reported, durationMs: ms6 };
    yield finish("stopped");
    return;
  }
  log.steps.push({ step: "report", durationMs: ms6, usage: reported.usage ?? undefined });
  yield { type: "step", step: "report", status: "done", result: reported, durationMs: ms6 };

  yield finish("complete");
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
