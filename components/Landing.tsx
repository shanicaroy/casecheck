"use client";

/**
 * The landing view from the UI reference: aurora, hero with the link field and
 * the two optional level selects, the "how this works" section with the photo
 * slot, the two disclosure blocks, and the footer with the §9 sentence.
 * Every word comes from content/copy.ts; the rubric names and weighting come
 * from rubric/dimensions.json.
 */
import { useState, type FormEvent } from "react";
import { copy } from "@/content/copy";
import dimensions from "@/rubric/dimensions.json";
import { LEVELS, isLevel, type Level } from "@/src/lib/levels";

export interface StartRequest {
  url: string;
  currentLevel?: Level;
  targetLevel?: Level;
}

const CURRENT_OPTIONS: Level[] = ["student", "junior", "mid", "senior"];
const TARGET_OPTIONS: Level[] = ["junior", "mid", "senior", "lead"];

export function Landing({ onStart, busy, problem }: { onStart: (req: StartRequest) => void; busy: boolean; problem: string | null }) {
  const [url, setUrl] = useState("");
  const [current, setCurrent] = useState("");
  const [target, setTarget] = useState("");
  const l = copy.landing;

  function submit(e: FormEvent) {
    e.preventDefault();
    onStart({
      url: url.trim(),
      currentLevel: isLevel(current) ? current : undefined,
      targetLevel: isLevel(target) ? target : undefined,
    });
  }

  const byId = new Map(dimensions.map((d) => [d.id, d]));

  return (
    <main className="landing">
      <div className="aurora" aria-hidden="true"><span className="a1" /><span className="a2" /><span className="a3" /></div>

      <section className="hero">
        <h1>{l.hero.title}</h1>
        <p>{l.hero.lede}</p>

        <form className="review-form" onSubmit={submit}>
          <input className="field" id="url" type="url" required placeholder={l.hero.placeholder} value={url}
            onChange={(e) => setUrl(e.target.value)} disabled={busy} aria-label={l.hero.placeholder} />
          <button className="btn btn-primary" type="submit" disabled={busy}>{l.hero.start}</button>
        </form>
        <div className="levels">
          <select className={`field select${current ? "" : " placeholder"}`} aria-label={l.hero.currentLevel} value={current} onChange={(e) => setCurrent(e.target.value)} disabled={busy}>
            <option value="">{l.hero.currentLevel}</option>
            {CURRENT_OPTIONS.map((lv) => <option key={lv} value={lv}>{l.levels[lv]}</option>)}
          </select>
          <select className={`field select${target ? "" : " placeholder"}`} aria-label={l.hero.targetLevel} value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy}>
            <option value="">{l.hero.targetLevel}</option>
            {TARGET_OPTIONS.map((lv) => <option key={lv} value={lv}>{l.levels[lv]}</option>)}
          </select>
        </div>
        <p className="hint">{l.hero.hint}</p>
        {problem && <p className="problem" role="alert">{problem}</p>}
        <a className="how btn-text" href="#brain">{l.hero.how}</a>
      </section>

      <section className="brain" id="brain">
        <div className="brain-head">
          <div className="photo" aria-label={l.brain.photoAlt}>
            {l.brain.photoSrc ? <img src={l.brain.photoSrc} alt={l.brain.photoAlt} /> : l.brain.photoSlot}
          </div>
          <div>
            <h2>{l.brain.title}</h2>
            <p className="who">{l.brain.who}</p>
            <p className="lede">{l.brain.lede1}</p>
            <p className="lede">{l.brain.lede2}</p>
          </div>
        </div>

        <div className="three">
          {l.brain.three.map((t) => (
            <div key={t.title}><h3>{t.title}</h3><p>{t.body}</p></div>
          ))}
        </div>

        <div style={{ marginTop: 48 }}>
          <details>
            <summary>{l.brain.twelveSummary}</summary>
            <div className="disc-body">
              <ul className="rubric">
                {l.brain.rubricOrder.map((id) => {
                  const d = byId.get(id)!;
                  const name = l.brain.rubricShortNames[id] ?? d.name;
                  return (
                    <li key={id}>
                      <b>{name} {d.star && <span className="star">{l.brain.weighted}</span>}</b>
                      {l.brain.rubricLines[id as keyof typeof l.brain.rubricLines]}
                    </li>
                  );
                })}
              </ul>
            </div>
          </details>
          <details>
            <summary>{l.brain.wontSummary}</summary>
            <div className="disc-body">{l.brain.wontBody}</div>
          </details>
        </div>
      </section>

      <footer className="foot">
        <p>{copy.dataHandling}</p>
      </footer>
    </main>
  );
}

export { LEVELS };
