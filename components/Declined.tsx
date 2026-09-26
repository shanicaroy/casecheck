"use client";

/**
 * Every refusal (contract §5) says why, in one sentence, and offers a route
 * forward. The route that always works is the fallback intake: paste the
 * case study's text, and add screenshots if part of the story lives in
 * images. Screenshots are downscaled in the browser before they are sent,
 * and nothing is stored.
 */
import { useRef, useState, type DragEvent } from "react";
import { ui } from "@/content/ui";
import { words } from "@/src/ui/format";
import type { PastedImage } from "@/src/steps/pasted";
import { You, Agent } from "@/components/Thread";
import { Tick } from "@/components/Glyph";

/** Mirrors the default thin floor in config/limits.ts; the server still enforces the real one. */
const FLOOR = 150;
const IMAGE_CAP = 8;
const MAX_EDGE = 1400;
const MAX_TOTAL_B64 = 3_800_000;

export interface DeclinedCopy {
  title: string;
  body: string;
}

export function Declined({ you, message, busy, onSubmit, onAnother }: {
  you: { what: string; levels: string };
  message: DeclinedCopy;
  busy: boolean;
  onSubmit: (pasted: { text: string; images: PastedImage[] }) => void;
  onAnother: () => void;
}) {
  const [text, setText] = useState("");
  const [shots, setShots] = useState<PastedImage[]>([]);
  const [over, setOver] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const d = ui.declined;
  const n = words(text);
  const enough = n >= FLOOR;

  async function add(files: FileList | null) {
    if (!files) return;
    setProblem(null);
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, IMAGE_CAP - shots.length);
    const next = [...shots];
    for (const file of picked) {
      try {
        next.push(await downscale(file));
      } catch {
        /* an unreadable image is skipped */
      }
    }
    if (next.reduce((sum, s) => sum + s.data.length, 0) > MAX_TOTAL_B64) {
      setProblem(d.shotsTooBig);
      return;
    }
    setShots(next);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setOver(false);
    void add(e.dataTransfer.files);
  }

  return (
    <main className="thread wide">
      <You what={you.what} levels={you.levels} />
      <Agent id="declined" top>
        <h1>{message.title}</h1>
        <p>{message.body}</p>
      </Agent>

      <div className="routes indent">
        <div className="route on">
          <div className="hd"><label htmlFor="paste">{d.pasteLabel}</label><span>{d.pasteTag}</span></div>
          <textarea id="paste" value={text} placeholder={d.pastePlaceholder} onChange={(e) => setText(e.target.value)} disabled={busy} />
          <div className="count" aria-live="polite">{enough && <Tick />}{d.count(n, FLOOR)}</div>
        </div>

        <div className="route">
          <div className="hd"><b>{d.shotsLabel}</b><span>{d.shotsTag(IMAGE_CAP)}</span></div>
          <div
            className={`drop${over ? " over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true"><rect x="3.5" y="5.5" width="21" height="17" rx="3" stroke="var(--ink-3)" strokeWidth="1.5" /><circle cx="10" cy="11.5" r="2" stroke="var(--ink-3)" strokeWidth="1.5" /><path d="M5 20l6-5.5 4 3.5 3.5-3 5 4.5" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinejoin="round" /></svg>
            <p>{shots.length ? d.shotsCount(shots.length) : d.shotsDrop}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="small-btn" onClick={() => fileRef.current?.click()} disabled={busy || shots.length >= IMAGE_CAP}>{d.shotsChoose}</button>
              {shots.length > 0 && <button type="button" className="small-btn" onClick={() => setShots([])}>{d.shotsClear}</button>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
          </div>
          <div className={`note${problem ? " bad" : ""}`} role={problem ? "alert" : undefined}>{problem ?? d.shotsNote}</div>
        </div>
      </div>

      <div className="submit-row indent">
        <span className="aside">{d.tip}</span>
        <div className="acts">
          <button type="button" className="b-link" onClick={onAnother}>{d.another}</button>
          <button type="button" className="b-primary" disabled={!enough || busy} onClick={() => onSubmit({ text, images: shots })}>{d.submit}</button>
        </div>
      </div>
    </main>
  );
}

/** Longest edge to MAX_EDGE, JPEG at 0.72. Returns base64 without the data: prefix. */
async function downscale(file: File): Promise<PastedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const data = canvas.toDataURL("image/jpeg", 0.72).split(",")[1] ?? "";
  return { data, width, height };
}
