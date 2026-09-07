"use client";

import { copy } from "@/content/copy";

/**
 * The header from the UI reference. The owner-mode toggle is only rendered
 * when the page was opened with ?owner in the URL (contract §14: reached by
 * a toggle or a query flag, never the default), so designers never see it.
 */
export function Header({ ownerAvailable, ownerOn, onToggleOwner, onHome }: {
  ownerAvailable: boolean;
  ownerOn: boolean;
  onToggleOwner: () => void;
  onHome: () => void;
}) {
  return (
    <header className="hdr">
      <a className="brand" href="/" onClick={(e) => { e.preventDefault(); onHome(); }}>
        <span className="mark" aria-hidden="true" />
        {copy.name}
      </a>
      <div className="hdr-right">
        <span>{copy.landing.headerNote}</span>
        {ownerAvailable && (
          <button type="button" className="btn-ghost" aria-pressed={ownerOn} onClick={onToggleOwner}>
            {copy.landing.ownerMode}
          </button>
        )}
      </div>
    </header>
  );
}
