"use client";

/**
 * The review, as a calm document (contract §14 order, v0.3 disclosure):
 *   verification line · the weakest part (reasoning one expansion away) ·
 *   the one fix · how it reads, on a level ladder · what's inside · secondary
 *   issues · limits and assumptions · where Case Check stops · the criteria.
 * No gradient here except the mark: the review is finished, so nothing moves.
 * Status reads by shape as well as colour. Owner mode (only with ?owner)
 * adds the telemetry panel under the verification line.
 */
import { useEffect, useRef, useState } from "react";
import { copy } from "@/content/copy";
import { ui } from "@/content/ui";
import dimensions from "@/rubric/dimensions.json";
import type { RunState } from "@/src/ui/runState";
import type { ReportOk } from "@/src/steps/report";
import type { SurvivingFinding } from "@/src/steps/verify";
import { LEVELS } from "@/src/lib/levels";
import { capital, levelWord } from "@/src/ui/format";
import { Glyph, Tick, Chevron, toGlyph } from "@/components/Glyph";
import { Mark } from "@/components/Mark";

const SECTIONS = [
  ["weakest", "The weakest part"],
  ["fix", "The one fix"],
  ["reads", "How it reads"],
  ["inside", "What's inside"],
  ["secondary", "Secondary issues"],
  ["limits", "Limits and assumptions"],
  ["next", "Next step"],
  ["how", "How Shanica evaluates"],
] as const;

export function Report({ run, reported, source, ownerOn, onRerun, onAnother }: {
  run: RunState;
  reported: ReportOk;
  source: string;
  ownerOn: boolean;
  onRerun: () => void;
  onAnother: () => void;
}) {
  const r = reported.report;
  const c = copy.report;
  const u = ui.report;
  const railRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState("weakest");
  const [answer, setAnswer] = useState<"yes" | "not_quite" | null>(null);

  const classify = run.classify && run.classify.ok ? run.classify : null;
  const classification = classify?.classification ?? null;
  const plan = run.plan && run.plan.ok ? run.plan.plan : null;
  const verified = run.verify && run.verify.ok ? run.verify : null;
  const title =
    (classify && classify.selectedIndex !== null && classification?.case_studies[classify.selectedIndex]?.title) ||
    classification?.case_studies[0]?.title ||
    c.untitled;
  const winner: SurvivingFinding | null = r.weakest_part && verified ? verified.surviving.find((f) => f.id === r.weakest_part!.id) ?? null : null;
  const planned = winner && plan ? plan.dimensions.find((d) => d.id === winner.id) ?? null : null;
  const target = levelWord(r.reads_as.target);
  const byId = new Map(dimensions.map((d) => [d.id, d]));

  // The rail follows the section in view.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) if (en.isIntersecting) setActive(en.target.id.replace("s-", ""));
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    document.querySelectorAll("[data-section]").forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  function send(a: "yes" | "not_quite") {
    setAnswer(a);
    if (!run.log) return;
    void fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ runId: run.log.runId, answer: a }) }).catch(() => {});
  }

  const shape = classification ? u.storyShape[classification.problem_type] : "";
  const levelsFact = plan
    ? plan.levels.currentSource === "stated" ? `${levelWord(plan.levels.current)}, targeting ${target.toLowerCase()}` : `Targeting ${target.toLowerCase()}`
    : "";
  const v = r.verification;

  return (
    <main className="report2">
      <nav className="rail2" aria-label="Sections" ref={railRef}>
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#s-${id}`} className={active === id ? "active" : undefined}>{label}</a>
        ))}
      </nav>

      <article className="doc2">
        {source && <div className="host">{source}</div>}
        <h1>{title}</h1>
        {(shape || levelsFact) && (
          <div className="facts">
            {shape && <span className="pill">{shape}</span>}
            {levelsFact && <span className="pill">{levelsFact}</span>}
          </div>
        )}
        <div className="verify-strip">
          <ShieldIcon />
          <span>
            {v.dropped ? <><b>{u.verifiedStrong(v.verified, v.made)}</b>{u.verifiedRest(v.dropped)}</> : <b>{u.verifiedAll(v.made)}</b>}
          </span>
        </div>

        {ownerOn && <Owner run={run} reported={reported} />}

        <section className="card" id="s-weakest" data-section style={{ marginTop: 40 }}>
          <div className="card-head">
            <div className="label">{c.rail.weakest}</div>
            {r.weakest_part && <span className="pill outline"><Glyph kind={toGlyph(winner?.verdict ?? "weak")} />{r.weakest_part.name}</span>}
          </div>
          {r.weakest_part ? (
            <>
              <h2>{r.weakest_part.headline}</h2>
              <p className="lead">{r.weakest_part.why_weak}</p>
              <figure className="quote2">
                {r.weakest_part.evidence.kind === "quote" ? (
                  <>
                    <blockquote>{`“${r.weakest_part.evidence.text}”`}</blockquote>
                    <figcaption><Tick />{u.foundOnPage}</figcaption>
                  </>
                ) : (
                  <blockquote>{c.restsOnImage(r.weakest_part.evidence.index, r.weakest_part.evidence.note)}</blockquote>
                )}
              </figure>
              {winner?.verdict === "not_on_this_page" && <p className="muted">{c.notOnThisPage}</p>}
              <div className="cols">
                <div><h4>{c.whyMatters}</h4><p>{r.weakest_part.why_it_matters}</p></div>
                <div><h4>{c.whyFirst}</h4><p>{r.weakest_part.why_it_outranks}</p></div>
              </div>
              {winner && (
                <details className="why">
                  <summary><span className="grow">{c.reasoning.summary}</span><Chevron /></summary>
                  <dl className="kv">
                    <div><dt>{c.reasoning.dimension}</dt><dd>{winner.name}</dd></div>
                    {planned && (
                      <div><dt>Where the plan pressed</dt><dd>{planned.emphasis === "press_hard" ? c.reasoning.pressed(planned.reason) : planned.emphasis === "light" ? c.reasoning.light(planned.reason) : c.reasoning.normal(planned.reason)}</dd></div>
                    )}
                    <div><dt>{c.reasoning.question}</dt><dd>{winner.question ?? c.reasoning.noQuestion}</dd></div>
                    <div><dt>{c.reasoning.confidence}</dt><dd>{capital(winner.confidence)}.{winner.confidenceReason ? ` ${winner.confidenceReason}` : ""}</dd></div>
                    <div><dt>{c.reasoning.verified}</dt><dd>{winner.evidence.kind === "image" ? c.reasoning.imageRead(winner.evidence.index) : winner.verification === "supports" ? c.reasoning.quoteFound : c.reasoning.quotePartial}</dd></div>
                  </dl>
                </details>
              )}
            </>
          ) : (
            <>
              <h2>{c.noWeakest}</h2>
              <p className="lead">{c.noWeakestBody}</p>
            </>
          )}
        </section>

        <section className="card soft" id="s-fix" data-section style={{ marginTop: 20 }}>
          <div className="card-head">
            <div className="label">{c.rail.fix}</div>
            {r.one_fix && <span className="pill white">{u.fixTag}</span>}
          </div>
          {r.one_fix ? (
            <>
              <h3>{r.one_fix.text}</h3>
              <p className="lead">{r.one_fix.detail}</p>
              <p className="muted">{c.fixFrame(target.toLowerCase())}</p>
            </>
          ) : <h3>{c.noFix}</h3>}
        </section>

        <section className="sec2" id="s-reads" data-section>
          <div className="label">{c.rail.reads}</div>
          <div className="reads-head">
            <h3>{r.reads_as.level === "unclear" ? u.readsUnclear : `${u.readsLabel} ${levelWord(r.reads_as.level).toLowerCase()}`}</h3>
            {r.reads_as.level !== "unclear" && <span className="pill">{u.confidence[r.reads_as.confidence] ?? capital(r.reads_as.confidence)}</span>}
          </div>
          <Ladder reads={r.reads_as.level} target={r.reads_as.target} />
          <p className="lead" style={{ marginTop: 24 }}>{r.reads_as.what_is_missing || c.nothingMissing(target.toLowerCase())}</p>
          <p className="muted" style={{ marginTop: 10 }}>{c.readsEstimate}</p>
        </section>

        <section className="sec2" id="s-inside" data-section>
          <div className="label">{c.rail.inside}</div>
          <h3>{c.insideTitle}</h3>
          <div className="inv">
            {r.inventory.map((i) => (
              <div className="inv-row" key={i.part}>
                <div className="part">{capital(i.part)}</div>
                <div className="stat"><Glyph kind={toGlyph(i.status)} />{c.statusWord[i.status]}</div>
                <div className={`ev${i.evidence ? "" : " none"}`}>{i.evidence ? `“${i.evidence}”` : c.noEvidence}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="sec2" id="s-secondary" data-section>
          <div className="label">{c.rail.secondary}</div>
          <h3>{c.secondaryTitle}</h3>
          {r.secondary.length === 0 ? <p className="muted">{c.secondaryNone}</p> : (
            <div className="list2">
              {r.secondary.map((s) => <div key={s.id}><b>{s.name}</b><span>{s.note}</span></div>)}
            </div>
          )}
        </section>

        <section className="sec2" id="s-limits" data-section>
          <div className="label">{c.rail.limits}</div>
          <div className="limits2">
            <div>
              <h4>{c.couldNot}</h4>
              {r.could_not_judge.map((t, i) => <p key={i}>{t}</p>)}
            </div>
            <div>
              <h4>{c.assumptions}</h4>
              {r.assumptions.length === 0 ? <p>{c.noAssumptions}</p> : r.assumptions.map((a, i) => <p key={i}>{a}</p>)}
            </div>
          </div>
        </section>

        <section className="stops-card" id="s-next" data-section>
          <div className="top">
            <Mark id="stops" />
            <div>
              <h3>{c.stopsTitle}</h3>
              <p>{c.stopsBody}</p>
            </div>
          </div>
          <div className="acts">
            <a className="b-primary" href={c.requestHref}>{c.request}</a>
            <button type="button" className="b-secondary" onClick={onRerun}>{c.rerun}</button>
            <button type="button" className="b-link" onClick={onAnother}>{c.another}</button>
          </div>
          <div className="fb">
            <span>{answer ? u.feedbackThanks : u.feedbackQ}</span>
            {!answer && (
              <div className="btns">
                <button type="button" className="pill-btn" onClick={() => send("yes")}>{u.feedbackYes}</button>
                <button type="button" className="pill-btn" onClick={() => send("not_quite")}>{u.feedbackNo}</button>
              </div>
            )}
          </div>
        </section>

        <section className="sec2" id="s-how" data-section>
          <div className="label">{c.rail.how}</div>
          <h3>{c.howTitle}</h3>
          <p className="muted" style={{ fontSize: 15, marginTop: 10 }}>{c.howLede}</p>
          <div className="crits">
            {c.howOrder.map((id) => {
              const d = byId.get(id)!;
              return (
                <details className="crit" key={id}>
                  <summary>
                    <span className="grow">{c.howShortNames[id] ?? d.name}</span>
                    {d.star && <span className="w">{copy.landing.brain.weighted.replace(/^./, (m) => m.toUpperCase())}</span>}
                    {"alwaysLight" in d && d.alwaysLight && <span className="w">{u.lightRead}</span>}
                    <Chevron />
                  </summary>
                  <div className="txt">{c.howLines[id as keyof typeof c.howLines]}</div>
                </details>
              );
            })}
          </div>
        </section>

        <p className="doc-foot">{u.footer}</p>
      </article>
    </main>
  );
}

/** Five stops, student to lead: a filled dot where the page reads, a ring at the target, the gap between them in black. */
function Ladder({ reads, target }: { reads: string; target: string }) {
  const u = ui.report;
  const at = (l: string) => LEVELS.indexOf(l as (typeof LEVELS)[number]);
  const ri = at(reads);
  const ti = at(target);
  const lo = ri >= 0 ? Math.min(ri, ti) : -1;
  const hi = ri >= 0 ? Math.max(ri, ti) : -1;
  const label = u.ladderLabel(ri >= 0 ? levelWord(reads).toLowerCase() : "unclear", levelWord(target).toLowerCase());
  return (
    <div className="ladder" role="img" aria-label={label}>
      <div className="track" />
      {lo >= 0 && hi > lo && <div className="span" style={{ left: `${lo * 20 + 10}%`, width: `${(hi - lo) * 20}%` }} />}
      <div className="stops">
        {LEVELS.map((l, i) => {
          const isNow = i === ri;
          const isAim = i === ti;
          const cls = isNow && isAim ? "both" : isNow ? "now" : isAim ? "aim" : "";
          return (
            <div className={`stop${cls ? " key" : ""}`} key={l}>
              <div className={`dot${cls ? ` ${cls}` : ""}`} />
              <div className="nm">{levelWord(l)}</div>
              {isNow && <div className="tag">{u.readsLabel}</div>}
              {isAim && !isNow && <div className="tag">{u.targetLabel}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Owner({ run, reported }: { run: RunState; reported: ReportOk }) {
  const c = copy.report;
  const verified = run.verify && run.verify.ok ? run.verify : null;
  if (!run.log || !verified) return null;
  return (
    <div className="owner2">
      <h4>{c.owner.heading}</h4>
      <table>
        <tbody>
          <tr><th>{c.owner.step}</th><th>{c.owner.model}</th><th>{c.owner.tokens}</th><th>{c.owner.time}</th></tr>
          {run.log.steps.map((s, i) => (
            <tr key={`${s.step}-${i}`}>
              <td>{copy.running.steps[s.step]}</td>
              <td>{s.usage ? (s.step === "verify" ? c.owner.verifyModel(s.usage.model) : s.usage.model) : c.owner.none}</td>
              <td>{s.usage ? `${s.usage.inputTokens.toLocaleString()} in / ${s.usage.outputTokens.toLocaleString()} out` : "0"}</td>
              <td>{(s.durationMs / 1000).toFixed(1)}s</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4>{c.owner.removed}</h4>
      {verified.dropped.length === 0 ? <ul><li>{copy.verify.sentenceNoneDropped.replace("{made}", String(verified.claimsMade))}</li></ul> : (
        <ul>
          {verified.dropped.map((d) => (
            <li key={d.id}>
              {d.quote ? `"${d.quote}" ` : `${d.name}: `}
              {d.stage === "quote_not_found" ? c.owner.quoteNotFound : d.stage === "does_not_support" ? c.owner.noSupport : d.stage === "image_not_found" ? c.owner.imageMissing : c.owner.noEvidence}
              {d.stage === "does_not_support" && d.reason ? ` ${d.reason}` : ""}
            </li>
          ))}
        </ul>
      )}
      <h4>{c.owner.ranking}</h4>
      <table>
        <tbody>
          {reported.choice.ranking.map((row) => (
            <tr key={row.id}>
              <td>{row.id} {row.name}</td>
              <td>{row.verdict}, {row.emphasis}, {row.confidence}{row.trustIssue ? ", trust" : ""}</td>
              <td>{row.candidate ? `score ${row.score.join(".")}` : row.excludedBecause}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {reported.adjustments.length > 0 && <ul style={{ marginTop: 10 }}>{reported.adjustments.map((a, i) => <li key={i}>{a}</li>)}</ul>}
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M10 2l6.5 2.6v4.8c0 4-2.8 7.2-6.5 8.6-3.7-1.4-6.5-4.6-6.5-8.6V4.6L10 2z" stroke="var(--present)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 10.2l2.2 2.2L13.4 8" stroke="var(--present)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
