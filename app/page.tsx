"use client";

/**
 * The page: one of four views from the UI reference v6.
 *   landing  — the composer; no header
 *   how      — how it works (#how)
 *   running  — while the pipeline streams; temporary raw panels until step 2
 *   report   — the review (#report); temporary raw panels until step 3
 * Back, Escape and the browser's back button return to the landing. Cancel
 * aborts the stream. Owner mode exists only with ?owner in the URL.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { Landing, type StartRequest } from "@/components/Landing";
import { How } from "@/components/How";
import { RawRun } from "@/components/RawRun";
import type { RunEvent } from "@/src/pipeline/run";
import { freshState, apply, type RunState } from "@/src/ui/runState";

type View = "landing" | "how" | "running" | "report";

export default function Page() {
  const [view, setView] = useState<View>("landing");
  const [request, setRequest] = useState<StartRequest | null>(null);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<RunState | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [ownerAvailable, setOwnerAvailable] = useState(false);
  const [ownerOn, setOwnerOn] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Owner mode is reachable only by query flag (contract §14); never the default.
  // Deep links: #how and #report open those views; a run is never restored from a hash.
  useEffect(() => {
    try {
      setOwnerAvailable(new URLSearchParams(window.location.search).has("owner"));
      const h = window.location.hash.replace("#", "");
      if (h === "how") setView("how");
    } catch {
      /* no window access */
    }
  }, []);

  const show = useCallback((next: View) => {
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
      if (e.key === "Escape" && view !== "landing") goBack();
    };
    const onPop = () => {
      const h = window.location.hash.replace("#", "");
      if (h === "how") setView("how");
      else if (h === "report" && run?.report) setView("report");
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

  async function start(req: StartRequest) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setProblem(null);
    setRequest(req);
    setRunning(true);
    const state = freshState();
    setRun({ ...state });
    show("running");

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: req.url, currentLevel: req.currentLevel, targetLevel: req.targetLevel }),
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
        for (const line of lines) if (line.trim()) apply(state, JSON.parse(line) as RunEvent);
        setRun({ ...state });
      }
      if (!controller.signal.aborted) show(state.report ? "report" : "running");
    } catch (err) {
      if (controller.signal.aborted) return;
      state.error = err instanceof Error ? err.message : String(err);
      setRun({ ...state });
    } finally {
      if (abortRef.current === controller) setRunning(false);
    }
  }

  function choose(option: { title: string; url: string | null }) {
    if (!option.url || !request) return;
    void start({ ...request, url: option.url });
  }

  if (view === "landing") {
    return <Landing onStart={start} onHow={() => show("how")} busy={running} problem={problem} />;
  }

  return (
    <>
      <Header
        onBack={goBack}
        ownerToggle={ownerAvailable && view === "report"}
        ownerOn={ownerOn}
        onToggleOwner={() => setOwnerOn((v) => !v)}
      />
      {view === "how" && <How />}
      {(view === "running" || view === "report") && run && <RawRun run={run} running={running} choose={choose} />}
    </>
  );
}
