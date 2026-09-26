"use client";

import type { ReactNode } from "react";
import { copy } from "@/content/copy";
import { Mark } from "@/components/Mark";

/**
 * The top bar on every view except the landing: back on the left, the name
 * in the centre, view actions on the right. Frosted and sticky, so the report
 * can scroll under it. On a phone the back label collapses to the chevron.
 */
export function Header({ onBack, backLabel, lined = false, right }: {
  onBack: () => void;
  backLabel: string;
  lined?: boolean;
  right?: ReactNode;
}) {
  return (
    <header className={`topbar${lined ? " lined" : ""}`}>
      <button className="back" type="button" onClick={onBack} aria-label={backLabel}>
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span>{backLabel}</span>
      </button>
      <div className="brand"><Mark id="brand" />{copy.name}</div>
      <div className="right">{right}</div>
    </header>
  );
}
