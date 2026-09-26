"use client";

import type { ReactNode } from "react";
import { Mark } from "@/components/Mark";

/** The designer's side of the conversation: what they sent, and the levels they chose. */
export function You({ what, levels }: { what: string; levels: string }) {
  return (
    <div className="you">
      <div className="what">{what}</div>
      {levels && <div className="levels">{levels}</div>}
    </div>
  );
}

/** Case Check's side: the mark (glowing only while it works) and what it says. */
export function Agent({ id, alive = false, top = false, children, aside }: {
  id: string;
  alive?: boolean;
  top?: boolean;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className={`agent${top ? " top" : ""}`}>
      <div className="mk" aria-hidden="true">
        {alive && <div className="halo" />}
        <Mark id={id} />
      </div>
      <div className="say">{children}</div>
      {aside}
    </div>
  );
}
