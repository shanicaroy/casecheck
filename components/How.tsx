"use client";

/**
 * The how-it-works view from the UI reference v6: the photo slot, the
 * introduction, the three columns, the two disclosure blocks, the §9 sentence.
 * Rubric names and weighting come from rubric/dimensions.json; the one-line
 * explanations from content/copy.ts.
 */
import { copy } from "@/content/copy";
import dimensions from "@/rubric/dimensions.json";

export function How() {
  const b = copy.landing.brain;
  const byId = new Map(dimensions.map((d) => [d.id, d]));
  return (
    <main className="how-page">
      <div className="brain-head">
        <div className="photo" aria-label={b.photoAlt}>
          {b.photoSrc ? <img src={b.photoSrc} alt={b.photoAlt} /> : b.photoSlot}
        </div>
        <div>
          <h2>{b.title}</h2>
          <p className="who">{b.who}</p>
          <p className="lede">{b.lede1}</p>
          <p className="lede">{b.lede2}</p>
        </div>
      </div>
      <div className="three">
        {b.three.map((t) => <div key={t.title}><h3>{t.title}</h3><p>{t.body}</p></div>)}
      </div>
      <div style={{ marginTop: 48 }}>
        <details>
          <summary>{b.twelveSummary}</summary>
          <div className="disc-body">
            <ul className="rubric">
              {b.rubricOrder.map((id) => {
                const d = byId.get(id)!;
                return (
                  <li key={id}>
                    <b>{b.rubricShortNames[id] ?? d.name} {d.star && <span className="star">{b.weighted}</span>}</b>
                    {b.rubricLines[id as keyof typeof b.rubricLines]}
                  </li>
                );
              })}
            </ul>
          </div>
        </details>
        <details>
          <summary>{b.wontSummary}</summary>
          <div className="disc-body">{b.wontBody}</div>
        </details>
      </div>
      <p className="foot">{copy.dataHandling}</p>
    </main>
  );
}
