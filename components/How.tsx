"use client";

/**
 * How Case Check works: whose criteria these are, the six steps as a real
 * sequence, the twelve checks, what it will not do, and what happens to the
 * page. Rubric names and weighting come from rubric/dimensions.json; the
 * one-line explanations from content/copy.ts.
 */
import { copy } from "@/content/copy";
import { ui } from "@/content/ui";
import dimensions from "@/rubric/dimensions.json";

export function How({ onStart }: { onStart: () => void }) {
  const b = copy.landing.brain;
  const h = ui.how;
  const byId = new Map(dimensions.map((d) => [d.id, d]));
  return (
    <main className="how2">
      <div className="photo2" aria-label={b.photoAlt}>
        {b.photoSrc ? <img src={b.photoSrc} alt={b.photoAlt} /> : b.photoSlot}
      </div>
      <h1>{b.title}</h1>
      <p className="who">{b.who}</p>
      <p className="lede2">{b.lede1}</p>
      <p className="lede2">{b.lede2}</p>
      <div className="cta-row"><button type="button" className="b-primary" onClick={onStart}>{h.cta}</button></div>

      <section>
        <h2>{h.stepsTitle}</h2>
        <p>{h.stepsLede}</p>
        <ol className="six">
          {h.steps.map((s, i) => (
            <li key={s.name}><span className="n">{i + 1}</span><b>{s.name}</b><span>{s.body}</span></li>
          ))}
        </ol>
      </section>

      <section>
        <h2>{h.twelveTitle}</h2>
        <p>{h.twelveLede}</p>
        <ul className="twelve">
          {b.rubricOrder.map((id) => {
            const d = byId.get(id)!;
            return (
              <li key={id}>
                <div className="nm">
                  {b.rubricShortNames[id] ?? d.name}
                  {d.star && <span>Weighted</span>}
                  {"alwaysLight" in d && d.alwaysLight && <span>{ui.report.lightRead}</span>}
                </div>
                <p>{b.rubricLines[id as keyof typeof b.rubricLines]}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="pair">
        <div><h2>{h.wontTitle}</h2><p>{b.wontBody}</p></div>
        <div><h2>{h.dataTitle}</h2><p>{copy.dataHandling}</p></div>
      </section>

      <div className="close-card">
        <div><b>{h.closeTitle}</b><span>{h.closeBody}</span></div>
        <button type="button" className="b-primary" onClick={onStart}>{h.cta}</button>
      </div>
    </main>
  );
}
