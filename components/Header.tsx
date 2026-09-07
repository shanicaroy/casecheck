"use client";

import { copy } from "@/content/copy";
import { Mark } from "@/components/Mark";

/**
 * The transparent header from the UI reference: Back on the left, the name in
 * the centre, context and owner mode on the right. Not rendered on the
 * landing. The owner-mode toggle only exists when the page was opened with
 * ?owner (contract §14: a toggle or a query flag, never the default) and only
 * on the report view, as the reference hides it elsewhere.
 */
export function Header({ onBack, ownerToggle, ownerOn, onToggleOwner }: {
  onBack: () => void;
  ownerToggle: boolean;
  ownerOn: boolean;
  onToggleOwner: () => void;
}) {
  return (
    <header className="hdr">
      <button className="back" type="button" onClick={onBack}>
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {copy.landing.back}
      </button>
      <div className="brand"><Mark />{copy.name}</div>
      <div className="hdr-right">
        <span>{copy.landing.headerNote}</span>
        {ownerToggle && (
          <button type="button" className="btn-ghost" aria-pressed={ownerOn} onClick={onToggleOwner}>{copy.landing.ownerMode}</button>
        )}
      </div>
    </header>
  );
}
