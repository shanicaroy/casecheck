"use client";

/**
 * The running view. Everything that moves here is tied to something real:
 *  - the segment bar and step icons follow the step events;
 *  - each step's timer counts from its own "running" event, beside the
 *    median of logged runs ("usually about Ns");
 *  - the lines under a step are the pipeline's own notes;
 *  - the twelve chips appear when the checks start, all checking together
 *    (they run as one call), outlined where the plan pressed hardest, and
 *    resolve to the real verdicts when the checks and then verification land;
 *  - "taking longer than usual" appears only once a step passes twice its
 *    usual time, with the age of the last server heartbeat, so slow and stuck
 *    look different. Thirty seconds of silence means the stream is gone.
 * The brand gradient is used only while the review is alive.
 */
import { useEffect, useRef, useState } from "react";
import { ui } from "@/content/ui";
import { activity } from "@/content/activity";
import { STEP_ORDER, type StepName } from "@/src/pipeline/steps";
import { DEFAULT_SECONDS, type StepTiming } from "@/src/lib/timings";
import type { RunState } from "@/src/ui/runState";
import { clock, levelWord } from "@/src/ui/format";
import { Glyph, Tick, Lock, type GlyphKind } from "@/components/Glyph";
import { You, Agent } from "@/components/Thread";
import { copy } from "@/content/copy";

const SILENT_MS = 30_000;

export function Running({ you, run, running, startedAt, endedAt, onCancel, onRetry, onOpenReport }: {
  you: { what: string; levels: string };
  run: RunState;
  running: boolean;
  startedAt: number;
  endedAt: number | null;
  onCancel: () => void;
  onRetry: () => void;
  onOpenReport: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [usual, setUsual] = useState<Record<StepName, number>>(DEFAULT_SECONDS);
  const readyRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [running]);

  // "Usually about Ns": medians of logged runs, defaults until enough exist.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/timings")
      .then((r) => (r.ok ? (r.json() as Promise<StepTiming[]>) : Promise.reject(new Error(String(r.status)))))
      .then((rows) => {
        if (cancelled) return;
        const next = { ...DEFAULT_SECONDS };
        for (const row of rows) next[row.step] = row.seconds;
        setUsual(next);
      })
      .catch(() => { /* defaults stay */ });
    return () => { cancelled = true; };
  }, []);

  const report = run.report && run.report.ok ? run.report : null;
  const ready = !!report;
  useEffect(() => {
    if (ready) readyRef.current?.focus({ preventScroll: true });
  }, [ready]);

  const failedStep = STEP_ORDER.find((s) => run.steps[s] === "failed") ?? null;
  const silent = running && now - run.lastEventAt > SILENT_MS;
  const stopped = !running && !ready;
  const alive = running && !silent;

  const classification = run.classify && run.classify.ok ? run.classify : null;
  const title =
    (classification && classification.selectedIndex !== null && classification.classification.case_studies[classification.selectedIndex]?.title) ||
    null;
  const activeIndex = STEP_ORDER.findIndex((s) => run.steps[s] === "running");
  const shownStep = activeIndex >= 0 ? activeIndex + 1 : STEP_ORDER.filter((s) => run.steps[s] !== "pending").length || 1;
  const totalUsual = STEP_ORDER.reduce((sum, s) => sum + usual[s], 0);
  const elapsed = (endedAt ?? now) - startedAt;

  let headline: string = title ? ui.running.reviewing(title) : ui.running.reviewingFallback;
  let subline = `${ui.running.step(shownStep)} ${ui.running.total(totalUsual)}`;
  if (ready) {
    const v = report.report.verification;
    headline = ui.running.readyHeadline;
    subline = ui.running.readySub(v.verified, v.made, v.dropped);
  } else if (stopped || silent) {
    subline = ui.running.stoppedTitle;
  }

  const chips = chipStates(run);
  const cardCls = ready ? "live calm" : stopped || silent ? "live stopped" : "live";

  return (
    <main className="thread">
      <You what={you.what} levels={you.levels} />

      <Agent id="run" alive={alive} aside={
        <div className="clock"><b>{clock(elapsed)}</b><span>{ui.running.elapsed}</span></div>
      }>
        <h1>{headline}</h1>
        <p className="small">{subline}</p>
      </Agent>

      <div className={cardCls}>
        <div className="live-inner">
          <div className="segs" aria-hidden="true">
            {STEP_ORDER.map((s) => {
              const st = run.steps[s];
              const cls = st === "done" || st === "needs_choice" ? " done" : st === "running" ? (alive ? " live-seg" : "") : st === "failed" ? " failed" : "";
              return <div key={s} className={`seg${cls}`} />;
            })}
          </div>

          <ol className="steps2" aria-label="Review steps">
            {STEP_ORDER.map((s) => {
              const st = run.steps[s];
              const state = st === "needs_choice" ? "done" : st;
              const took = run.durationMs[s];
              const since = run.startedAt[s] ? Math.max(0, Math.round((now - run.startedAt[s]!) / 1000)) : 0;
              const right =
                state === "done" && took !== null ? ui.running.took(Math.max(1, Math.round(took / 1000)))
                : state === "running" ? ui.running.live(since, usual[s])
                : state === "pending" ? ui.running.usually(usual[s])
                : "";
              const slow = state === "running" && running && !silent && since > Math.max(usual[s] * 2, usual[s] + 10);
              const showChips = s === "checks" && (state === "running" || state === "done" || run.steps.verify !== "pending");
              return (
                <li className="st" data-state={state} key={s}>
                  <div className="ic">
                    {state === "done" && <DoneIcon />}
                    {state === "running" && (alive ? <div className="spin" aria-hidden="true" /> : <div className="pend" />)}
                    {state === "pending" && <div className="pend" />}
                    {state === "failed" && <FailIcon />}
                  </div>
                  <div className="body">
                    <div className="row">
                      <div className={`name${state === "running" && alive ? " shim" : ""}`}>{copy.running.steps[s]}</div>
                      <div className="time">{right}</div>
                    </div>

                    {state === "done" && run.lines[s].length > 0 && <div className="result">{run.lines[s].join(". ")}</div>}

                    {state === "running" && (
                      <>
                        <div className={`doing${alive ? " shim-2" : ""}`}>{activity.active[s]}</div>
                        {run.lines[s].map((line, i) => <div className="fact" key={i}><Tick />{line}</div>)}
                      </>
                    )}

                    {showChips && (
                      <div>
                        <div className="chips">
                          {ui.chipOrder.map((id) => {
                            const c = chips[id];
                            return (
                              <div key={id} className={`chip${c.pressed ? " pressed" : ""}`} title={ui.chips[id]}>
                                {c.kind === "checking" ? <span className="dotc" style={{ animationDelay: `${ui.chipOrder.indexOf(id) * 0.08}s` }} /> : <Glyph kind={c.kind} />}
                                <span className="chip-t">{ui.chips[id]}</span>
                              </div>
                            );
                          })}
                        </div>
                        {state === "running" ? (
                          <div className="legend">{ui.running.chipsChecking}</div>
                        ) : (
                          <div className="legend">
                            <span><Glyph kind="present" />{ui.status.present}</span>
                            <span><Glyph kind="weak" />{ui.status.weak}</span>
                            <span><Glyph kind="missing" />{ui.status.missing}</span>
                            <span>{run.verify && run.verify.ok ? ui.running.chipsVerified : ui.running.chipsToVerify}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {slow && (
                      <div className="notice" role="status">
                        <b><ClockIcon />{ui.running.slowTitle}</b>
                        <span><i className="beat" aria-hidden="true" />{ui.running.slowBody(Math.max(0, Math.round((now - run.lastEventAt) / 1000)), usual[s])}</span>
                      </div>
                    )}

                    {state === "failed" && (
                      <div className="notice" role="alert">
                        <b>{ui.running.stoppedTitle}</b>
                        <span>{ui.running.stoppedBody}</span>
                        <div className="acts">
                          <button className="b-primary" type="button" onClick={onRetry}>{ui.running.retry}</button>
                          <button className="b-secondary" type="button" onClick={onCancel}>{ui.header.newReview}</button>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {(silent || (stopped && !failedStep)) && (
            <div className="notice" role="alert" style={{ margin: "4px 0 18px" }}>
              <b>{silent ? ui.running.silentTitle : ui.running.stoppedTitle}</b>
              <span>{silent ? ui.running.silentBody : ui.running.stoppedBody}</span>
              <div className="acts">
                <button className="b-primary" type="button" onClick={onRetry}>{ui.running.retry}</button>
                <button className="b-secondary" type="button" onClick={onCancel}>{ui.header.newReview}</button>
              </div>
            </div>
          )}

          {ready && (
            <div className="ready">
              <div>
                <b>{report.report.weakest_part ? ui.running.readyTitle(report.report.weakest_part.name) : ui.running.readyNone}</b>
                <span>{ui.running.readyBody(levelWord(report.report.reads_as.target))}</span>
              </div>
              <button ref={readyRef} className="b-primary" type="button" onClick={onOpenReport}>{ui.running.readyCta}</button>
            </div>
          )}
        </div>
      </div>

      <div className="foot-row">
        <span className="safe"><Lock />{ui.running.safe}</span>
        {running && <button type="button" className="b-quiet" onClick={onCancel}>{ui.running.cancel}</button>}
      </div>

      <div className="sr" aria-live="polite">
        {ready ? ui.running.readyHeadline : activeIndex >= 0 ? `${ui.running.step(activeIndex + 1)} ${copy.running.steps[STEP_ORDER[activeIndex]]}` : ""}
      </div>
    </main>
  );
}

/** Chip state per rubric id: checking until the checks land, then the real verdict, verified or not. */
function chipStates(run: RunState): Record<string, { kind: GlyphKind | "checking"; pressed: boolean }> {
  const pressed = new Set<string>(run.plan && run.plan.ok ? run.plan.plan.dimensions.filter((d) => d.emphasis === "press_hard").map((d) => d.id) : []);
  const verdicts = new Map<string, string>();
  let resolved = false;
  if (run.verify && run.verify.ok) {
    resolved = true;
    for (const f of run.verify.surviving) verdicts.set(f.id, f.verdict);
  } else if (run.checks && run.checks.ok) {
    resolved = true;
    for (const f of run.checks.findings) if (f.status === "kept") verdicts.set(f.id, f.verdict);
  }
  const out: Record<string, { kind: GlyphKind | "checking"; pressed: boolean }> = {};
  for (const id of ui.chipOrder) {
    const v = verdicts.get(id);
    const kind: GlyphKind | "checking" = !resolved ? "checking" : id === "K" || id === "L" || !v ? "neutral" : v === "present" ? "present" : v === "weak" ? "weak" : "missing";
    out[id] = { kind, pressed: pressed.has(id) };
  }
  return out;
}

function DoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="#000" />
      <path d="M6 10.2l2.7 2.7L14 7.6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="9.25" fill="none" stroke="var(--missing)" strokeWidth="1.5" />
      <path d="M10 5.5v5.5" stroke="var(--missing)" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="10" cy="14" r="1" fill="var(--missing)" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 4.8V8l2.2 1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
