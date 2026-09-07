"use client";

/**
 * The report view, ported from the UI reference's #view-report: sticky rail on
 * the left, a 720px reading column, sections in the contract's §14 order.
 * Everything rendered comes from slice 6's typed Report plus the run's own
 * findings and log. Owner mode shows the telemetry panel and the dropped
 * claims; it is off by default and only reachable with ?owner in the URL.
 */
import { useEffect, useRef } from "react";
import { copy } from "@/content/copy";
import dimensions from "@/rubric/dimensions.json";
import type { RunState } from "@/src/ui/runState";
import type { ReportOk } from "@/src/steps/report";
import type { SurvivingFinding } from "@/src/steps/verify";
import type { Level } from "@/src/lib/levels";

const SECTIONS = ["weakest", "fix", "reads", "inside", "secondary", "limits", "how"] as const;

function levelWord(level: string): string {
  const map = copy.landing.levels as Record<string, string>;
  return (map[level] ?? level).toLowerCase();
}

export function Report({ run, reported, ownerOn, onRerun, onAnother }: {
  run: RunState;
  reported: ReportOk;
  ownerOn: boolean;
  onRerun: () => void;
  onAnother: () => void;
}) {
  const r = reported.report;
  const c = copy.report;
  const railRef = useRef<HTMLElement>(null);
  const classification = run.classify && run.classify.ok ? run.classify.classification : null;
  const plan = run.plan && run.plan.ok ? run.plan.plan : null;
  const verified = run.verify && run.verify.ok ? run.verify : null;
  const title = classification?.case_studies[0]?.title || c.untitled;
  const winner: SurvivingFinding | null = r.weakest_part && verified ? verified.surviving.find((f) => f.id === r.weakest_part!.id) ?? null : null;
  const planned = winner && plan ? plan.dimensions.find((d) => d.id === winner.id) ?? null : null;
  const target = levelWord(r.reads_as.target as Level);

  // Rail highlight follows the section in view (reference behaviour).
  useEffect(() => {
    const links = Array.from(railRef.current?.querySelectorAll("a") ?? []);
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${en.target.id}`));
        }
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    document.querySelectorAll(".sec").forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  const byId = new Map(dimensions.map((d) => [d.id, d]));

  return (
    <main className="report">
      <nav className="rail" aria-label="Sections" ref={railRef}>
        {SECTIONS.map((s, i) => <a key={s} href={`#s-${s}`} className={i === 0 ? "active" : undefined}>{c.rail[s]}</a>)}
      </nav>

      <article className="doc">
        <div className="title">{title}</div>
        <div className="verif">{c.verif(r.verification.made, r.verification.verified, r.verification.dropped)}</div>

        {ownerOn && run.log && verified && (
          <div className="owner">
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
            <h4 style={{ marginTop: 16 }}>{c.owner.removed}</h4>
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
            <h4 style={{ marginTop: 16 }}>{c.owner.ranking}</h4>
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
            {reported.adjustments.length > 0 && <ul className="trail">{reported.adjustments.map((a, i) => <li key={i}>{a}</li>)}</ul>}
          </div>
        )}

        <section className="sec" id="s-weakest">
          <div className="kicker">{c.rail.weakest}</div>
          {r.weakest_part && winner ? (
            <>
              <h2>{r.weakest_part.headline}</h2>
              <p>{r.weakest_part.why_weak}</p>
              {r.weakest_part.evidence.kind === "quote"
                ? <div className="quote"><q>{r.weakest_part.evidence.text}</q></div>
                : <div className="absent">{c.restsOnImage(r.weakest_part.evidence.index, r.weakest_part.evidence.note)}</div>}
              {winner.verdict === "not_on_this_page" && <div className="absent">{c.notOnThisPage}</div>}
              <div className="two">
                <div><h4>{c.whyMatters}</h4><p>{r.weakest_part.why_it_matters}</p></div>
                <div><h4>{c.whyFirst}</h4><p>{r.weakest_part.why_it_outranks}</p></div>
              </div>
              <details className="reason">
                <summary>{c.reasoning.summary}</summary>
                <div className="disc-body">
                  <span>{c.reasoning.dimension}</span><span>{winner.name}</span>
                  <span>{c.reasoning.plan}</span>
                  <span>{planned ? (planned.emphasis === "press_hard" ? c.reasoning.pressed(planned.reason) : planned.emphasis === "light" ? c.reasoning.light(planned.reason) : c.reasoning.normal(planned.reason)) : ""}</span>
                  <span>{c.reasoning.question}</span><span>{winner.question ?? c.reasoning.noQuestion}</span>
                  <span>{c.reasoning.confidence}</span><span>{capital(winner.confidence)}.{winner.confidenceReason ? ` ${winner.confidenceReason}` : ""}</span>
                  <span>{c.reasoning.verified}</span>
                  <span>{winner.evidence.kind === "image" ? c.reasoning.imageRead(winner.evidence.index) : winner.verification === "supports" ? c.reasoning.quoteFound : c.reasoning.quotePartial}</span>
                </div>
              </details>
            </>
          ) : (
            <>
              <h2>{c.noWeakest}</h2>
              <p>{c.noWeakestBody}</p>
            </>
          )}
        </section>

        <section className="sec" id="s-fix">
          <div className="kicker">{c.rail.fix}</div>
          {r.one_fix ? (
            <>
              <h3>{r.one_fix.text}</h3>
              <p>{r.one_fix.detail}</p>
              <p className="muted">{c.fixFrame(target)}</p>
            </>
          ) : <h3>{c.noFix}</h3>}
        </section>

        <section className="sec" id="s-reads">
          <div className="kicker">{c.rail.reads}</div>
          <div className="reads"><h3>{c.readsAs(levelWord(r.reads_as.level))}</h3><span className="conf">{c.confidence(r.reads_as.confidence)}</span></div>
          <p>{r.reads_as.what_is_missing || c.nothingMissing(target)}</p>
          <p className="muted">{c.readsEstimate}</p>
        </section>

        <section className="sec" id="s-inside">
          <div className="kicker">{c.rail.inside}</div>
          <h3>{c.insideTitle}</h3>
          <table>
            <tbody>
              <tr><th>{c.part}</th><th>{c.status}</th><th>{c.evidence}</th></tr>
              {r.inventory.map((i) => (
                <tr key={i.part}>
                  <td>{capital(i.part)}</td>
                  <td><span className={`dot ${i.status}`} />{c.statusWord[i.status]}</td>
                  <td className="ev">{i.evidence ? `"${i.evidence}"` : c.noEvidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="sec" id="s-secondary">
          <div className="kicker">{c.rail.secondary}</div>
          <h3>{c.secondaryTitle}</h3>
          {r.secondary.length === 0 ? <p className="muted">{c.secondaryNone}</p> : (
            <ul className="list">
              {r.secondary.map((s2) => <li key={s2.id}><b>{s2.name}.</b><span>{s2.note}</span></li>)}
            </ul>
          )}
        </section>

        <section className="sec" id="s-limits">
          <div className="kicker">{c.rail.limits}</div>
          <div className="two" style={{ marginTop: 0 }}>
            <div>
              <h4>{c.couldNot}</h4>
              {r.could_not_judge.map((t, i) => <p key={i} style={i ? { marginTop: 10 } : undefined}>{t}</p>)}
            </div>
            <div>
              <h4>{c.assumptions}</h4>
              {r.assumptions.length === 0 ? <p>{c.noAssumptions}</p> : r.assumptions.map((a, i) => <p key={i} style={i ? { marginTop: 10 } : undefined}>{a}</p>)}
            </div>
          </div>
        </section>

        <section className="sec" id="s-how">
          <div className="kicker">{c.rail.how}</div>
          <h3>{c.howTitle}</h3>
          <p className="muted">{c.howLede}</p>
          <div style={{ marginTop: 20 }}>
            {c.howOrder.map((id) => (
              <details key={id}>
                <summary>{c.howShortNames[id] ?? byId.get(id)!.name}</summary>
                <div className="disc-body">{c.howLines[id as keyof typeof c.howLines]}</div>
              </details>
            ))}
          </div>
        </section>

        <div className="actions">
          <button className="btn btn-primary" type="button" onClick={onRerun}>{c.rerun}</button>
          <button className="btn btn-secondary" type="button" onClick={onAnother}>{c.another}</button>
        </div>

        <div className="stops">
          <h3>{c.stopsTitle}</h3>
          <p>{c.stopsBody}</p>
          <a className="btn-text" href={c.requestHref}>{c.request}</a>
        </div>
      </article>
    </main>
  );
}

function capital(t: string): string {
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}
