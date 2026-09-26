"use client";

/**
 * The link was a portfolio with several case studies. Which one gets
 * reviewed is the designer's choice, never the model's (contract §7), so the
 * run stopped and asks. Each card starts a fresh run on that case study.
 */
import { ui } from "@/content/ui";
import { pathOf } from "@/src/ui/format";
import { You, Agent } from "@/components/Thread";

export function Clarify({ you, options, onChoose, onDirect }: {
  you: { what: string; levels: string };
  options: { title: string; url: string | null }[];
  onChoose: (url: string) => void;
  onDirect: () => void;
}) {
  return (
    <main className="thread wide">
      <You what={you.what} levels={you.levels} />
      <Agent id="clarify" top>
        <h1>{ui.clarify.title(options.length)}</h1>
        <p>{ui.clarify.body}</p>
      </Agent>
      <div className="options indent">
        {options.map((o, i) => (
          <button key={i} type="button" className="option" disabled={!o.url} onClick={() => o.url && onChoose(o.url)}>
            {o.url && <span className="path">{pathOf(o.url)}</span>}
            <span className="t">{o.title}</span>
            {o.url ? <span className="go">{ui.clarify.pick}</span> : <span className="no">{ui.clarify.noLink}</span>}
          </button>
        ))}
      </div>
      <p className="aside indent">
        {ui.clarify.direct}{" "}
        <button type="button" className="b-link" onClick={onDirect}>{ui.clarify.directCta}</button>
      </p>
    </main>
  );
}
