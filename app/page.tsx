"use client";

/**
 * The single page. It collects a link, starts a run through /api/run, and
 * renders each step as its event arrives on the stream. Every word on screen
 * comes from content/copy.ts. No review logic lives here.
 */
import { useState, type FormEvent } from "react";
import { copy } from "@/content/copy";
import type { FetchFail } from "@/src/steps/fetch";
import type { ClassifyResult } from "@/src/steps/classify";
import type { PlanResult } from "@/src/steps/plan";
import type { ChecksResult } from "@/src/steps/checks";
import type { VerifyResult } from "@/src/steps/verify";
import type { ReportResult } from "@/src/steps/report";
import type { RunEvent, RunLog, FetchOkPublic, Declined } from "@/src/pipeline/run";
import { STEP_ORDER, type StepName } from "@/src/pipeline/steps";

type StepState = "pending" | "running" | "done" | "failed" | "needs_choice" | "not_built";

interface RunState {
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

const BUILT: StepName[] = ["fetch", "classify", "plan", "checks", "verify", "report"];

function freshState(): RunState {
  const steps = Object.fromEntries(STEP_ORDER.map((s) => [s, BUILT.includes(s) ? "pending" : "not_built"])) as Record<StepName, StepState>;
  return { steps, fetch: null, classify: null, plan: null, checks: null, verify: null, report: null, declined: null, options: null, log: null, error: null };
}

export default function Page() {
  const [url, setUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<RunState | null>(null);

  async function start(target: string) {
    setRunning(true);
    const state = freshState();
    setRun({ ...state });

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      if (!response.ok || !response.body) throw new Error(`Server answered ${response.status}.`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) apply(state, JSON.parse(line) as RunEvent);
        setRun({ ...state });
      }
    } catch (err) {
      state.error = err instanceof Error ? err.message : String(err);
      setRun({ ...state });
    } finally {
      setRunning(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void start(url);
  }

  function choose(option: { title: string; url: string | null }) {
    if (!option.url) return;
    setUrl(option.url);
    void start(option.url);
  }

  return (
    <main>
      <h1>{copy.name}</h1>
      <p>{copy.tagline}</p>
      <p className="notice">{copy.buildStatus}</p>

      <form onSubmit={onSubmit}>
        <label htmlFor="url">{copy.form.label}</label>
        <div className="row">
          <input id="url" type="url" required placeholder={copy.form.placeholder} value={url}
            onChange={(e) => setUrl(e.target.value)} disabled={running} />
          <button type="submit" disabled={running}>{copy.form.submit}</button>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>{copy.dataHandling}</p>
      </form>

      {run && (
        <ol className="steps" aria-live="polite">
          {STEP_ORDER.map((step, i) => (
            <li key={step} className={`step ${run.steps[step]}`}>
              <span className="step-index">{i + 1}</span>
              <span className="step-name">{copy.steps[step]}</span>
              <span className="step-status">{statusLabel(run.steps[step])}</span>
            </li>
          ))}
        </ol>
      )}

      {run?.error && (
        <section className="panel fail"><h2>{copy.result.failHeading}</h2><p>{run.error}</p></section>
      )}

      {run?.report && !run.report.ok && (
        <section className="panel fail">
          <h2>{copy.report.failHeading}</h2>
          <dl className="facts"><dt>Reason</dt><dd><code>{run.report.reason}</code></dd><dt>Detail</dt><dd>{run.report.detail}</dd></dl>
        </section>
      )}

      {run?.report && run.report.ok && (() => {
        const r = run.report.report;
        const w = r.weakest_part;
        return (
          <section className="panel report">
            <h2>{copy.report.weakest}</h2>
            {w ? (
              <>
                <p className="lead">{w.plain_words} <span className="muted">({w.id} {w.name}{w.trust_issue ? `, ${copy.report.trustProblem}` : ""} · confidence {w.confidence})</span></p>
                {w.evidence.kind === "quote" ? <blockquote>“{w.evidence.text}”</blockquote> : <p className="muted">{copy.report.restsOn}: image {w.evidence.index}, {w.evidence.note}</p>}
                <p><strong>{copy.report.whyWeak}:</strong> {w.why_weak}</p>
                <p><strong>{copy.report.whyOutranks}:</strong> {w.why_it_outranks}</p>
              </>
            ) : (
              <p>{copy.report.noWeakest}</p>
            )}

            <h2>{copy.report.fix}</h2>
            <p>{r.one_fix ? r.one_fix.text : copy.report.nothingMissing}</p>

            <h2>{copy.report.readsAs} ~{r.reads_as.level} <span className="muted">(confidence {r.reads_as.confidence}) · {copy.report.aimingFor} {r.reads_as.target}</span></h2>
            <p>{copy.report.missingToward.replace("{target}", r.reads_as.target)}: {r.reads_as.what_is_missing || copy.report.nothingMissing}</p>

            <h2>{copy.report.inventory}</h2>
            <table className="inventory"><tbody>
              {r.inventory.map((i) => (
                <tr key={i.part}><th>{i.part}</th><td><code className={i.status}>{i.status}</code></td><td className="muted">{i.evidence ? `“${i.evidence}”` : ""}</td></tr>
              ))}
            </tbody></table>

            {r.secondary.length > 0 && (
              <>
                <h2>{copy.report.secondary}</h2>
                <ul className="muted">{r.secondary.map((s2) => <li key={s2.id}><strong>{s2.name}</strong> ({s2.verdict}): {s2.note}</li>)}</ul>
              </>
            )}

            <h2>{copy.report.couldNotJudge}</h2>
            <ul>{r.could_not_judge.map((t, i) => <li key={i}>{t}</li>)}</ul>

            <h2>{copy.report.assumptions}</h2>
            {r.assumptions.length ? <ul>{r.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul> : <p className="muted">(none)</p>}

            <h2>{copy.report.howSure}</h2>
            <p>{r.verification.sentence}</p>

            <details>
              <summary>{copy.report.ranking}</summary>
              <table className="plan"><tbody>
                {run.report.choice.ranking.map((row) => (
                  <tr key={row.id}>
                    <th>{row.id}</th>
                    <td>{row.name}</td>
                    <td><code>{row.verdict}</code> · {row.emphasis} · {row.confidence}{row.trustIssue ? " · trust" : ""}</td>
                    <td className="muted">{row.candidate ? `score ${row.score.join(".")}` : row.excludedBecause}</td>
                  </tr>
                ))}
              </tbody></table>
              {run.report.tieBrokenBy && <p className="muted">Tie broken by the model: {run.report.tieBrokenBy}</p>}
              {run.report.adjustments.length > 0 && <ul className="muted">{run.report.adjustments.map((a, i) => <li key={i}>{a}</li>)}</ul>}
            </details>
          </section>
        );
      })()}

      {run?.fetch && !run.fetch.ok && (
        <section className="panel fail">
          <h2>{copy.result.failHeading}</h2>
          <dl className="facts">
            <dt>Reason</dt><dd><code>{run.fetch.reason}</code></dd>
            <dt>Detail</dt><dd>{run.fetch.detail}</dd>
            {run.fetch.status !== undefined && (<><dt>Status</dt><dd>{run.fetch.status}</dd></>)}
          </dl>
        </section>
      )}

      {run?.fetch && run.fetch.ok && (
        <section className="panel">
          <h2>{copy.result.okHeading}</h2>
          <dl className="facts">
            <dt>Title</dt><dd>{run.fetch.title || "(none)"}</dd>
            <dt>Final URL</dt><dd>{run.fetch.finalUrl}</dd>
            <dt>Words</dt><dd>{run.fetch.wordCount} · narrative {run.fetch.narrativeWordCount}</dd>
            <dt>Links</dt><dd>{run.fetch.links.length}</dd>
            <dt>Images</dt><dd>{run.fetch.images.length} captured of {run.fetch.imageCandidates}{run.fetch.embeds.length ? ` · ${run.fetch.embeds.length} embedded media` : ""}</dd>
            <dt>Took</dt><dd>{run.fetch.durationMs} ms</dd>
          </dl>
          <details>
            <summary>{copy.result.textHeading}</summary>
            <pre className="text">{run.fetch.text || "(no visible text)"}</pre>
          </details>
        </section>
      )}

      {run?.classify && !run.classify.ok && (
        <section className="panel fail">
          <h2>{copy.classify.failHeading}</h2>
          <dl className="facts">
            <dt>Reason</dt><dd><code>{run.classify.reason}</code></dd>
            <dt>Detail</dt><dd>{run.classify.detail}</dd>
          </dl>
        </section>
      )}

      {run?.options && (
        <section className="panel">
          <h2>{copy.classify.chooseHeading}</h2>
          <p>{copy.classify.chooseBody}</p>
          <ul className="options">
            {run.options.map((o, i) => (
              <li key={i}>
                {o.url
                  ? <button type="button" onClick={() => choose(o)} disabled={running}>{o.title}</button>
                  : <span>{o.title} <span className="muted">({copy.classify.noLink})</span></span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {run?.classify && run.classify.ok && (() => {
        const c = run.classify.classification;
        return (
          <section className="panel">
            <h2>{copy.classify.heading}</h2>
            <dl className="facts">
              <dt>Page kind</dt><dd><code>{c.page_kind}</code> · {c.page_kind_reason}</dd>
              <dt>Case studies</dt><dd>{c.case_studies.length === 0 ? "none found" : c.case_studies.map((cs) => cs.title).join(" · ")}</dd>
              <dt>Problem type</dt><dd><code>{c.problem_type}</code></dd>
              <dt>Seniority</dt><dd>{copy.plan.readsAs} ~<code>{c.seniority}</code> · confidence <code>{c.seniority_confidence}</code></dd>
              <dt>Case type</dt><dd>{c.case_type.length ? c.case_type.join(", ") : "unclear"}</dd>
              <dt>Confidence</dt><dd><code>{c.confidence}</code>{c.notes ? ` · ${c.notes}` : ""}</dd>
              <dt>Model</dt><dd>{run.classify.usage.model} · {run.classify.usage.inputTokens} in / {run.classify.usage.outputTokens} out · {run.classify.usage.durationMs} ms</dd>
            </dl>

            <h2>{copy.classify.inventoryHeading}</h2>
            <table className="inventory">
              <tbody>
                {(Object.keys(c.inventory) as (keyof typeof c.inventory)[]).map((k) => (
                  <tr key={k}>
                    <th>{k}</th>
                    <td><code className={c.inventory[k].status}>{c.inventory[k].status}</code></td>
                    <td className="muted">{c.inventory[k].evidence ? `“${c.inventory[k].evidence}”` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {c.external_case_study_links.length > 0 && (
              <>
                <h2>{copy.classify.externalLinks}</h2>
                <ul>{c.external_case_study_links.map((l, i) => <li key={i}>{l.text} <span className="muted">{l.href}</span></li>)}</ul>
              </>
            )}
            {c.assumptions.length > 0 && (
              <>
                <h2>{copy.classify.assumptionsHeading}</h2>
                <ul>{c.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </>
            )}
          </section>
        );
      })()}

      {run?.plan && !run.plan.ok && (
        <section className="panel fail">
          <h2>{copy.plan.failHeading}</h2>
          <dl className="facts">
            <dt>Reason</dt><dd><code>{run.plan.reason}</code></dd>
            <dt>Detail</dt><dd>{run.plan.detail}</dd>
          </dl>
        </section>
      )}

      {run?.plan && run.plan.ok && (() => {
        const p = run.plan.plan;
        return (
          <section className="panel">
            <h2>{copy.plan.heading}</h2>
            <p>{p.summary}</p>
            <p className="muted">
              {copy.plan.readsAs} ~{p.levels.current} ({p.levels.currentSource}) · {copy.plan.aimingFor} {p.levels.target} ({p.levels.targetSource === "stated" ? copy.plan.stated : copy.plan.assumed})
            </p>
            <table className="plan">
              <tbody>
                {p.dimensions.map((d) => (
                  <tr key={d.id} className={d.emphasis}>
                    <th>{d.id}{d.star ? " ★" : ""}</th>
                    <td>{d.name}</td>
                    <td><code className={d.emphasis}>{copy.plan.emphasis[d.emphasis]}</code></td>
                    <td>{d.question ? <strong>{d.question}</strong> : <span className="muted">{d.reason}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {run.plan.adjustments.length > 0 && (
              <ul className="muted">{run.plan.adjustments.map((a, i) => <li key={i}>{a}</li>)}</ul>
            )}
          </section>
        );
      })()}

      {run?.declined && (
        <section className="panel fail">
          <h2>{copy.declined.heading}</h2>
          <p>{copy.declined[run.declined.reason]}</p>
          <p className="muted">{copy.declined.detailLabel}: {run.declined.detail}</p>
        </section>
      )}

      {run?.checks && !run.checks.ok && (
        <section className="panel fail">
          <h2>{copy.checks.failHeading}</h2>
          <dl className="facts">
            <dt>Reason</dt><dd><code>{run.checks.reason}</code></dd>
            <dt>Detail</dt><dd>{run.checks.detail}</dd>
          </dl>
        </section>
      )}

      {run?.checks && run.checks.ok && (() => {
        const ch = run.checks;
        return (
          <section className="panel">
            <h2>{copy.checks.heading}</h2>
            {!run.verify && <p className="muted">{copy.checks.unverified}</p>}
            <ol className="findings">
              {ch.findings.map((f) => (
                <li key={f.id} className={`finding ${f.status} ${f.verdict}`}>
                  <div className="finding-head">
                    <span className="finding-id">{f.id}{f.star ? " ★" : ""}</span>
                    <span className="finding-name">{f.name}</span>
                    <code className={f.status === "dropped" ? "dropped" : f.verdict}>{f.status === "dropped" ? copy.checks.dropped : copy.checks.verdict[f.verdict]}</code>
                    <span className="muted">{copy.checks.confidence} {f.confidence}{f.confidenceReason ? ` · ${f.confidenceReason}` : ""}</span>
                  </div>
                  {f.status === "dropped" ? (
                    <p className="muted">{f.dropReason}</p>
                  ) : (
                    <>
                      {f.evidence?.kind === "quote" && <blockquote>“{f.evidence.text}”</blockquote>}
                      {f.evidence?.kind === "image" && <p className="muted">{copy.checks.imageEvidence} {f.evidence.index}: {f.evidence.note}</p>}
                      <p>{f.reasoning}</p>
                      {f.answerToQuestion && <p><strong>{copy.checks.answer}:</strong> {f.answerToQuestion}</p>}
                      {f.levelGap && <p className="muted"><strong>{copy.checks.levelGap}:</strong> {f.levelGap}</p>}
                    </>
                  )}
                </li>
              ))}
            </ol>
            {ch.imagesRead.length > 0 && (
              <>
                <h2>{copy.checks.imagesRead}</h2>
                <ul>{ch.imagesRead.map((i) => <li key={i.index}>{copy.checks.imageEvidence} {i.index}: {[i.narrative_recovered, i.artefact_verified].filter(Boolean).join(" · ") || "nothing usable"}</li>)}</ul>
              </>
            )}
            {ch.couldNotJudge.length > 0 && (
              <>
                <h2>{copy.checks.couldNotJudge}</h2>
                <ul>{ch.couldNotJudge.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </>
            )}
            {ch.adjustments.length > 0 && <ul className="muted">{ch.adjustments.map((a, i) => <li key={i}>{a}</li>)}</ul>}
          </section>
        );
      })()}

      {run?.verify && !run.verify.ok && (
        <section className="panel fail">
          <h2>{copy.verify.failHeading}</h2>
          <dl className="facts">
            <dt>Reason</dt><dd><code>{run.verify.reason}</code></dd>
            <dt>Detail</dt><dd>{run.verify.detail}</dd>
          </dl>
        </section>
      )}

      {run?.verify && run.verify.ok && (() => {
        const v = run.verify;
        const droppedCount = v.claimsMade - v.claimsSurviving;
        const template = droppedCount === 0 ? copy.verify.sentenceNoneDropped : copy.verify.sentence;
        const sentence = template
          .replace("{made}", String(v.claimsMade))
          .replace("{surviving}", String(v.claimsSurviving))
          .replace("{dropped}", String(droppedCount));
        return (
          <section className="panel">
            <h2>{copy.verify.heading}</h2>
            <p>{sentence}</p>
            {v.dropped.length > 0 && (
              <>
                <h2>{copy.verify.droppedHeading}</h2>
                <ul>
                  {v.dropped.map((d) => (
                    <li key={d.id}>
                      <strong>{d.id} {d.name}</strong> · {copy.verify.stage[d.stage]} · <span className="muted">{d.reason}</span>
                      {d.quote && <blockquote>“{d.quote}”</blockquote>}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {v.downgraded.length > 0 && (
              <>
                <h2>{copy.verify.downgradedHeading}</h2>
                <ul>{v.downgraded.map((d) => <li key={d.id}><strong>{d.id}</strong> {d.from} → {d.to} · <span className="muted">{d.reason}</span></li>)}</ul>
              </>
            )}
          </section>
        );
      })()}

      <footer><p className="muted">{copy.limits}</p></footer>
    </main>
  );
}

function statusLabel(s: StepState): string {
  switch (s) {
    case "pending": return "";
    case "running": return "running…";
    case "done": return "done";
    case "failed": return "failed";
    case "needs_choice": return "needs your choice";
    case "not_built": return copy.steps.notBuilt;
  }
}

/** Fold one stream event into the run state. */
function apply(state: RunState, event: RunEvent) {
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
