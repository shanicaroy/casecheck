"use client";

/**
 * The single page. It collects a link, runs step 1 (fetch) through
 * /api/fetch, and shows the raw result. Every word on screen comes from
 * content/copy.ts. No review logic lives here.
 */
import { useState, type FormEvent } from "react";
import { copy } from "@/content/copy";
import type { FetchResult } from "@/src/steps/fetch";

type Phase = "idle" | "running" | "done";

export default function Page() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<FetchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPhase("running");
    setResult(null);
    setError(null);
    try {
      const response = await fetch("/api/fetch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      // The API answers with a FetchResult even on 500, so read the body first.
      const body = (await response.json().catch(() => null)) as FetchResult | null;
      if (!body) throw new Error(`Server answered ${response.status} with no detail.`);
      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPhase("done");
    }
  }

  return (
    <main>
      <h1>{copy.name}</h1>
      <p>{copy.tagline}</p>
      <p className="notice">{copy.buildStatus}</p>

      <form onSubmit={onSubmit}>
        <label htmlFor="url">{copy.form.label}</label>
        <div className="row">
          <input
            id="url"
            type="url"
            required
            placeholder={copy.form.placeholder}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={phase === "running"}
          />
          <button type="submit" disabled={phase === "running"}>
            {copy.form.submit}
          </button>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>{copy.dataHandling}</p>
        <p className="status" aria-live="polite">{phase === "running" ? copy.form.running : ""}</p>
      </form>

      {error && (
        <section className="panel fail">
          <h2>{copy.result.failHeading}</h2>
          <p>{error}</p>
        </section>
      )}

      {result && !result.ok && (
        <section className="panel fail">
          <h2>{copy.result.failHeading}</h2>
          <dl className="facts">
            <dt>Reason</dt><dd><code>{result.reason}</code></dd>
            <dt>Detail</dt><dd>{result.detail}</dd>
            {result.status !== undefined && (<><dt>Status</dt><dd>{result.status}</dd></>)}
            {result.contentType && (<><dt>Content type</dt><dd>{result.contentType}</dd></>)}
            <dt>Took</dt><dd>{result.durationMs} ms</dd>
          </dl>
        </section>
      )}

      {result && result.ok && (
        <section className="panel">
          <h2>{copy.result.okHeading}</h2>
          <dl className="facts">
            <dt>Title</dt><dd>{result.title || "(none)"}</dd>
            <dt>Final URL</dt><dd>{result.finalUrl}</dd>
            <dt>Status</dt><dd>{result.status}</dd>
            <dt>Words</dt><dd>{result.wordCount}</dd>
            <dt>Images</dt><dd>{result.imageCount}</dd>
            <dt>Took</dt><dd>{result.durationMs} ms</dd>
          </dl>
          <h2>{copy.result.textHeading}</h2>
          <pre className="text">{result.text || "(no visible text)"}</pre>
        </section>
      )}

      <footer>
        <p className="muted">{copy.limits}</p>
      </footer>
    </main>
  );
}
