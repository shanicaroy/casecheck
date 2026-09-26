/**
 * Status marks. Each status differs in shape as well as colour, so it reads
 * without colour vision: present is a filled dot, weak is half filled,
 * missing is an empty ring, and "not judged" is a dash.
 */
export type GlyphKind = "present" | "weak" | "missing" | "neutral";

export function toGlyph(verdict: string): GlyphKind {
  if (verdict === "present") return "present";
  if (verdict === "weak") return "weak";
  if (verdict === "missing" || verdict === "not_on_this_page") return "missing";
  return "neutral";
}

export function Glyph({ kind, size = 12 }: { kind: GlyphKind; size?: number }) {
  return (
    <svg className="glyph" width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      {kind === "present" && <circle cx="6" cy="6" r="5" fill="var(--present)" />}
      {kind === "weak" && (
        <>
          <circle cx="6" cy="6" r="4.5" fill="none" stroke="var(--weak)" strokeWidth="1.5" />
          <path d="M6 1.5a4.5 4.5 0 0 1 0 9z" fill="var(--weak)" />
        </>
      )}
      {kind === "missing" && <circle cx="6" cy="6" r="4.5" fill="none" stroke="var(--missing)" strokeWidth="1.5" />}
      {kind === "neutral" && <path d="M3 6h6" stroke="var(--ink-4)" strokeWidth="1.5" strokeLinecap="round" />}
    </svg>
  );
}

/** A small green tick, for facts the pipeline has confirmed. */
export function Tick() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2.5 6.2l2.2 2.2L9.5 3.6" stroke="var(--present)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Chevron() {
  return (
    <svg className="chev" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Lock({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke={color} strokeWidth="1.3" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke={color} strokeWidth="1.3" />
    </svg>
  );
}
