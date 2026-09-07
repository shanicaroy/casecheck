"use client";

/**
 * The landing from the UI reference v6: no header. The mark, one line, the
 * composer (link field, the two optional level selects, the start button),
 * one trust line, one link to the how-it-works view. Vertically centred over
 * the aurora. The start button wakes when a link is present; the light behind
 * the composer follows the cursor unless motion is reduced.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { copy } from "@/content/copy";
import { Mark } from "@/components/Mark";
import { isLevel, type Level } from "@/src/lib/levels";

export interface StartRequest {
  url: string;
  currentLevel?: Level;
  targetLevel?: Level;
}

const CURRENT_OPTIONS: Level[] = ["student", "junior", "mid", "senior"];
const TARGET_OPTIONS: Level[] = ["junior", "mid", "senior", "lead"];

export function Landing({ onStart, onHow, busy, problem }: { onStart: (req: StartRequest) => void; onHow: () => void; busy: boolean; problem: string | null }) {
  const [url, setUrl] = useState("");
  const [current, setCurrent] = useState("");
  const [target, setTarget] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const l = copy.landing;

  // Cursor light: the glow's centre eases toward the pointer (reference behaviour).
  useEffect(() => {
    const wrap = wrapRef.current;
    const main = mainRef.current;
    if (!wrap || !main || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let tx = 50, ty = 50, cx = 50, cy = 50, raf: number | null = null;
    const step = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      wrap.style.setProperty("--mx", `${cx}%`);
      wrap.style.setProperty("--my", `${cy}%`);
      raf = Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1 ? requestAnimationFrame(step) : null;
    };
    const onMove = (e: MouseEvent) => {
      const r = wrap.getBoundingClientRect();
      tx = Math.max(-40, Math.min(140, ((e.clientX - r.left) / r.width) * 100));
      ty = Math.max(-80, Math.min(180, ((e.clientY - r.top) / r.height) * 100));
      if (raf === null) raf = requestAnimationFrame(step);
    };
    main.addEventListener("mousemove", onMove);
    return () => {
      main.removeEventListener("mousemove", onMove);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    onStart({
      url: url.trim(),
      currentLevel: isLevel(current) ? current : undefined,
      targetLevel: isLevel(target) ? target : undefined,
    });
  }

  return (
    <main className="landing" ref={mainRef}>
      <div className="aurora" aria-hidden="true"><span className="a1" /><span className="a2" /><span className="a3" /><span className="a4" /></div>
      <section className="hero">
        <div className="avatar" aria-hidden="true"><Mark /></div>
        <h1>{l.hero.title}</h1>

        <div className={`reviewer-wrap${url.trim() ? " has-url" : ""}`} ref={wrapRef}>
          <div className="reviewer-glow" aria-hidden="true" />
          <form className="reviewer" onSubmit={submit}>
            <input className="reviewer-input" id="url" type="url" required autoComplete="off" placeholder={l.hero.placeholder}
              aria-label={l.hero.placeholder} value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy} />
            <div className="reviewer-bar">
              <div className="reviewer-tools">
                <select className={`tool${current ? "" : " placeholder"}`} aria-label={l.hero.currentLevel} value={current} onChange={(e) => setCurrent(e.target.value)} disabled={busy}>
                  <option value="">{l.hero.currentLevel}</option>
                  {CURRENT_OPTIONS.map((lv) => <option key={lv} value={lv}>{l.levels[lv]}</option>)}
                </select>
                <select className={`tool${target ? "" : " placeholder"}`} aria-label={l.hero.targetLevel} value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy}>
                  <option value="">{l.hero.targetLevel}</option>
                  {TARGET_OPTIONS.map((lv) => <option key={lv} value={lv}>{l.levels[lv]}</option>)}
                </select>
              </div>
              <button className="btn-start" type="submit" disabled={busy}>{l.hero.start}</button>
            </div>
          </form>
        </div>

        <p className="trust">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" stroke="#3B3B3B" strokeWidth="1.3" /><path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="#3B3B3B" strokeWidth="1.3" /></svg>
          {l.hero.trust}
        </p>
        {problem && <p className="problem" role="alert">{problem}</p>}
        <a className="how" href="#how" onClick={(e) => { e.preventDefault(); onHow(); }}>{l.hero.how}</a>
      </section>
    </main>
  );
}
