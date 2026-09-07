"use client";

/**
 * The running view, ported 1:1 from the UI reference's #view-running: the
 * orb with the mark, "Reviewing", the URL with the scheme stripped, the meta
 * row with the elapsed timer ticking every 500ms from the real start time and
 * Cancel, then the six steps as a bare list. State per step comes from
 * data-state; sub-activity lines are the pipeline's real events, nothing
 * else. "Usually about Ns" is the median of logged runs, or the reference's
 * default until five runs exist.
 */
import { useEffect, useRef, useState } from "react";
import { copy } from "@/content/copy";
import { Mark } from "@/components/Mark";
import { useFloat } from "@/src/ui/useFloat";
import { STEP_ORDER, type StepName } from "@/src/pipeline/steps";
import { DEFAULT_SECONDS, type StepTiming } from "@/src/lib/timings";
import type { RunState, StepState } from "@/src/ui/runState";

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function dataState(s: StepState): "idle" | "active" | "done" | "failed" {
  if (s === "running") return "active";
  if (s === "done" || s === "needs_choice") return "done";
  if (s === "failed") return "failed";
  return "idle";
}

export function Running({ url, startedAt, run, running, onCancel, onChoose }: {
  url: string;
  startedAt: number;
  run: RunState;
  running: boolean;
  onCancel: () => void;
  onChoose: (o: { title: string; url: string | null }) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [timings, setTimings] = useState<Record<StepName, number>>(DEFAULT_SECONDS);
  const orbRef = useRef<HTMLDivElement>(null);
  useFloat(orbRef);

  // Elapsed: every 500ms from the real start, frozen once the run ends.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [running]);

  // "Usually about Ns": medians of logged runs, defaults otherwise.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/timings")
      .then((r) => (r.ok ? (r.json() as Promise<StepTiming[]>) : Promise.reject(new Error(String(r.status)))))
      .then((rows) => {
        if (cancelled) return;
        const next = { ...DEFAULT_SECONDS };
        for (const row of rows) next[row.step] = row.seconds;
        setTimings(next);
      })
      .catch(() => {
        /* defaults stay */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const r = copy.running;
  const failure = failureLine(run);

  return (
    <main className="running">
      <div className="orb" aria-hidden="true" ref={orbRef}><Mark id="orb" /></div>
      <div className="label">{r.label}</div>
      <div className="url">{url.replace(/^https?:\/\//, "")}</div>
      <div className="meta">
        <span>{r.elapsed(fmt(Math.max(0, now - startedAt)))}</span>
        <button className="btn-text" type="button" onClick={onCancel}>{running ? r.cancel : r.another}</button>
      </div>

      <div className="steps">
        {STEP_ORDER.map((step, i) => {
          const state = dataState(run.steps[step]);
          return (
            <div className="step" data-state={state} data-step={step} key={step}>
              <div className="n"><span>{i + 1}</span></div>
              <div className="name">{r.steps[step]}</div>
              <div className="eta">{r.usually(timings[step])}</div>
              <div className="lines">
                {run.lines[step].map((line, j) => <div key={j}>{line}</div>)}
                {step === "classify" && run.options && (
                  <div className="choose">
                    <div>{r.chooseIntro}</div>
                    {run.options.map((o, j) =>
                      o.url
                        ? <button key={j} type="button" className="btn-text" onClick={() => onChoose(o)} disabled={running}>{o.title}</button>
                        : <div key={j}>{o.title} {r.noLink}</div>,
                    )}
                  </div>
                )}
                {failure && failure.step === step && <div className="problem">{failure.text}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

/** The one real line for a run that stopped: the reason, under the step it stopped at. */
function failureLine(run: RunState): { step: StepName; text: string } | null {
  if (run.declined) return { step: "classify", text: `${copy.declined[run.declined.reason]} ${run.declined.detail}` };
  if (run.fetch && !run.fetch.ok) return { step: "fetch", text: run.fetch.detail };
  if (run.classify && !run.classify.ok) return { step: "classify", text: run.classify.detail };
  if (run.plan && !run.plan.ok) return { step: "plan", text: run.plan.detail };
  if (run.checks && !run.checks.ok) return { step: "checks", text: run.checks.detail };
  if (run.verify && !run.verify.ok) return { step: "verify", text: run.verify.detail };
  if (run.report && !run.report.ok) return { step: "report", text: run.report.detail };
  if (run.error) return { step: "fetch", text: run.error };
  return null;
}
