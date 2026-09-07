"use client";

/**
 * Temporary: the raw run panels from the build slices, shown after a run starts
 * until the running (step 2) and report (step 3) views are built to the UI
 * reference. Nothing here is designed; it is the pipeline's output, visible.
 */
import { copy } from "@/content/copy";
import { STEP_ORDER } from "@/src/pipeline/steps";
import type { RunState, StepState } from "@/src/ui/runState";

export function RawRun({ run, running, choose }: { run: RunState; running: boolean; choose: (o: { title: string; url: string | null }) => void }) {
  return (
    <div className="raw">
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

      {run.error && (
        <section className="panel fail"><h2>{copy.result.failHeading}</h2><p>{run.error}</p></section>
      )}

      {run.report && !run.report.ok && (
        <section className="panel fail">
          <h2>{copy.report.failHeading}</h2>
          <dl className="facts"><dt>Reason</dt><dd><code>{run.report.reason}</code></dd><dt>Detail</dt><dd>{run.report.detail}</dd></dl>
        </section>
      )}

      {run.report && run.report.ok && (() => {
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

      {run.fetch && !run.fetch.ok && (
        <section className="panel fail">
          <h2>{copy.result.failHeading}</h2>
          <dl className="facts">
            <dt>Reason</dt><dd><code>{run.fetch.reason}</code></dd>
            <dt>Detail</dt><dd>{run.fetch.detail}</dd>
            {run.fetch.status !== undefined && (<><dt>Status</dt><dd>{run.fetch.status}</dd></>)}
          </dl>
        </section>
      )}

      {run.fetch && run.fetch.ok && (
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

      {run.classify && !run.classify.ok && (
        <section className="panel fail">
          <h2>{copy.classify.failHeading}</h2>
          <dl className="facts">
            <dt>Reason</dt><dd><code>{run.classify.reason}</code></dd>
            <dt>Detail</dt><dd>{run.classify.detail}</dd>
          </dl>
        </section>
      )}

      {run.options && (
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

      {run.classify && run.classify.ok && (() => {
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

      {run.plan && !run.plan.ok && (
        <section className="panel fail">
          <h2>{copy.plan.failHeading}</h2>
          <dl className="facts">
            <dt>Reason</dt><dd><code>{run.plan.reason}</code></dd>
            <dt>Detail</dt><dd>{run.plan.detail}</dd>
          </dl>
        </section>
      )}

      {run.plan && run.plan.ok && (() => {
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

      {run.declined && (
        <section className="panel fail">
          <h2>{copy.declined.heading}</h2>
          <p>{copy.declined[run.declined.reason]}</p>
          <p className="muted">{copy.declined.detailLabel}: {run.declined.detail}</p>
        </section>
      )}

      {run.checks && !run.checks.ok && (
        <section className="panel fail">
          <h2>{copy.checks.failHeading}</h2>
          <dl className="facts">
            <dt>Reason</dt><dd><code>{run.checks.reason}</code></dd>
            <dt>Detail</dt><dd>{run.checks.detail}</dd>
          </dl>
        </section>
      )}

      {run.checks && run.checks.ok && (() => {
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

      {run.verify && !run.verify.ok && (
        <section className="panel fail">
          <h2>{copy.verify.failHeading}</h2>
          <dl className="facts">
            <dt>Reason</dt><dd><code>{run.verify.reason}</code></dd>
            <dt>Detail</dt><dd>{run.verify.detail}</dd>
          </dl>
        </section>
      )}

      {run.verify && run.verify.ok && (() => {
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

    </div>
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

