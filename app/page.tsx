"use client";

/**
 * The page: one of six views.
 *   landing   the composer; no header (unchanged)
 *   how       how it works (#how)
 *   running   while the pipeline streams, from real per-step events only
 *   clarify   the link held several case studies; the designer picks one
 *   declined  the page can't be reviewed honestly; says why, offers the paste fallback
 *   report    the review (#report)
 * Where a finished run lands is decided in one place, settle(), from the
 * run's own results. Back, Escape and the browser's back button return to
 * the landing. Owner mode exists only with ?owner in the URL.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { Landing, type StartRequest } from "@/components/Landing";
import { How } from "@/components/How";
import { Running } from "@/components/Running";
import { Clarify } from "@/components/Clarify";
import { Declined, type DeclinedCopy } from "@/components/Declined";
import { Report } from "@/components/Report";
import { ui, READER_BLOCKING_HOSTS } from "@/content/ui";
import { freshState, apply, type RunState, type StreamEvent } from "@/src/ui/runState";
import { displaySource, hostOf, levelWord, normalizeUrl, words } from "@/src/ui/format";
import type { PastedImage } from "@/src/steps/pasted";

type View = "landing" | "how" | "running" | "clarify" | "declined" | "report";

interface Request extends StartRequest {
  pasted?: { text: string; images: PastedImage[] };
}

const OPEN_REPORT_AFTER_MS = 1600;

/** The label of the reader-blocking host this link belongs to, or null. */
function readerBlocker(url: string | null | undefined): string | null {
  const host = url ? hostOf(url) : null;
  if (!host) return null;
  const hit = Object.entries(READER_BLOCKING_HOSTS).find(([h]) => host === h || host.endsWith(`.${h}`));
  return hit ? hit[1] : null;
}

export default function Page() {
  const [view, setView] = useState<View>("landing");
  const [request, setRequest] = useState<Request | null>(null);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<RunState | null>(null);
  const [declined, setDeclined] = useState<DeclinedCopy | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [ownerAvailable, setOwnerAvailable] = useState(false);
  const [ownerOn, setOwnerOn] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      setOwnerAvailable(new URLSearchParams(window.location.search).has("owner"));
      if (window.location.hash === "#how") setView("how");
    } catch {
      /* no window access */
    }
  }, []);

  const show = useCallback((next: View) => {
    if (openTimer.current) clearTimeout(openTimer.current);
    setView(next);
    window.scrollTo({ top: 0 });
    const hash = next === "how" || next === "report" ? `#${next}` : "";
    try {
      if (window.location.hash !== hash) history.pushState(null, "", hash || window.location.pathname + window.location.search);
    } catch {
      /* sandboxed previews forbid URL changes */
    }
  }, []);

  const goBack = useCallback(() => {
    abortRef.current?.abort();
    show("landing");
  }, [show]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.tagName === "SELECT")) return;
      if (e.key === "Escape" && view !== "landing") goBack();
    };
    const onPop = () => {
      const h = window.location.hash.replace("#", "");
      if (h === "how") setView("how");
      else if (h === "report" && run?.report?.ok) setView("report");
      else {
        abortRef.current?.abort();
        setView("landing");
      }
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
    };
  }, [view, run, goBack]);

  async function start(reqIn: Request) {
    abortRef.current?.abort();
    setProblem(null);
    // A pasted link is rarely a perfect URL ("behance.net/…" with no scheme is
    // the common one). Give it an https:// so the guard below and the fetch step
    // both see a real link, not something they reject.
    const req: Request = reqIn.url ? { ...reqIn, url: normalizeUrl(reqIn.url) } : reqIn;
    setRequest(req);
    setDeclined(null);

    // A host known to block readers is caught before a doomed run starts.
    if (!req.pasted && req.url) {
      const blocker = readerBlocker(req.url);
      if (blocker) {
        setRun(null);
        setDeclined(ui.declined.blocked(blocker));
        show("declined");
        return;
      }
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setStartedAt(Date.now());
    setEndedAt(null);
    const state = freshState();
    setRun({ ...state });
    show("running");

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          req.pasted
            ? { text: req.pasted.text, images: req.pasted.images, currentLevel: req.currentLevel, targetLevel: req.targetLevel }
            : { url: req.url, currentLevel: req.currentLevel, targetLevel: req.targetLevel },
        ),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`Server answered ${response.status}.`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) apply(state, JSON.parse(line) as StreamEvent);
        setRun({ ...state });
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      state.error = err instanceof Error ? err.message : String(err);
      setRun({ ...state });
    } finally {
      if (abortRef.current === controller) {
        setRunning(false);
        setEndedAt(Date.now());
      }
    }
    if (!controller.signal.aborted) settle(state, req.url);
  }

  /** Where a finished run lands. Anything not listed stays on the running view, which shows it stopped and offers a retry. */
  function settle(state: RunState, requestedUrl?: string) {
    if (state.report?.ok) {
      openTimer.current = setTimeout(() => show("report"), OPEN_REPORT_AFTER_MS);
      return;
    }
    if (state.options) {
      show("clarify");
      return;
    }
    const d = ui.declined;
    // If the link was a host known to block readers, say that plainly whatever
    // the wire reason was: a 403, a login redirect and a challenge page all mean
    // the same thing to the designer, and only the paste fallback will work.
    const failedUrl = (state.fetch && !state.fetch.ok ? state.fetch.requestedUrl : null) ?? requestedUrl ?? null;
    const blocker = readerBlocker(failedUrl);
    let message: DeclinedCopy | null = null;
    if (state.declined) message = d.thin(state.declined.narrativeWordCount, state.declined.floor);
    else if (state.fetch && !state.fetch.ok) {
      const f = state.fetch;
      if (blocker) message = d.blocked(blocker);
      else if (f.reason === "http_error" && (f.status === 401 || f.status === 403)) message = d.login;
      else if (f.reason === "http_error" || f.reason === "unreachable") message = d.dead;
      else if (f.reason === "timeout") message = d.timeout;
      else if (f.reason === "not_html") message = d.notHtml;
      else if (f.reason === "invalid_url") message = d.invalid;
      // browser_unavailable, unexpected, or any reason added later: never leave
      // the run stuck on the running view. Offer the paste fallback.
      else message = d.dead;
    } else if (state.error && blocker) {
      // The stream or the route itself failed before any step reported, and the
      // link was a known reader-blocker: say so, and offer the paste fallback.
      // Other transport errors stay on the running view, which offers a retry.
      message = d.blocked(blocker);
    } else if (state.classify?.ok && state.classify.selectedIndex === null && !state.classify.needsChoice && state.finished === "stopped") {
      message = d.notCase;
    }
    if (message) {
      setDeclined(message);
      show("declined");
    }
  }

  const you = request
    ? {
        what: request.pasted
          ? ui.bubble.pasted(words(request.pasted.text), request.pasted.images.length)
          : displaySource(request.url ?? ""),
        levels: ui.bubble.levels(request.currentLevel ? levelWord(request.currentLevel) : null, request.targetLevel ? levelWord(request.targetLevel) : null),
      }
    : { what: "", levels: "" };

  if (view === "landing") {
    return <Landing onStart={(req) => void start(req)} onHow={() => show("how")} busy={running} problem={problem} />;
  }

  const report = run?.report?.ok ? run.report : null;
  const source = request?.pasted ? ui.report.pastedHost : run?.fetch?.ok ? displaySource(run.fetch.finalUrl) : displaySource(request?.url ?? "");

  return (
    <>
      <Header
        onBack={goBack}
        backLabel={view === "how" ? ui.header.back : ui.header.newReview}
        lined={view === "report"}
        right={view === "report" ? (
          <>
            {ownerAvailable && (
              <button type="button" className="icon-btn owner-btn" aria-pressed={ownerOn} onClick={() => setOwnerOn((v) => !v)}>Owner</button>
            )}
            <button type="button" className="icon-btn" onClick={() => window.print()} aria-label={ui.header.print}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4.5 6V2.5h7V6M4.5 11.5h-2V6h11v5.5h-2" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><rect x="4.5" y="9.5" width="7" height="4.5" stroke="currentColor" strokeWidth="1.3" /></svg>
              <span className="t">{ui.header.print}</span>
            </button>
          </>
        ) : undefined}
      />
      {view === "how" && <How onStart={goBack} />}
      {view === "running" && run && request && (
        <Running
          you={you}
          run={run}
          running={running}
          startedAt={startedAt}
          endedAt={endedAt}
          onCancel={goBack}
          onRetry={() => void start(request)}
          onOpenReport={() => show("report")}
        />
      )}
      {view === "clarify" && run?.options && request && (
        <Clarify you={you} options={run.options} onChoose={(url) => void start({ ...request, url, pasted: undefined })} onDirect={goBack} />
      )}
      {view === "declined" && declined && request && (
        <Declined
          you={you}
          message={declined}
          busy={running}
          onSubmit={(pasted) => void start({ ...request, pasted })}
          onAnother={goBack}
        />
      )}
      {view === "report" && run && report && (
        <Report run={run} reported={report} source={source} ownerOn={ownerOn} onRerun={() => request && void start(request)} onAnother={goBack} />
      )}
    </>
  );
}
