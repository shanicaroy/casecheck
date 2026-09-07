"use client";

/**
 * The page: one of three views. Landing until a run starts; then the running
 * view while the pipeline streams; then the report. Steps 2 and 3 of the
 * output layer replace the temporary raw panels with the reference's running
 * and report views. Run state and the stream reader live here.
 */
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Landing, type StartRequest } from "@/components/Landing";
import { RawRun } from "@/components/RawRun";
import type { RunEvent } from "@/src/pipeline/run";
import { freshState, apply, type RunState } from "@/src/ui/runState";

export default function Page() {
  const [request, setRequest] = useState<StartRequest | null>(null);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<RunState | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [ownerAvailable, setOwnerAvailable] = useState(false);
  const [ownerOn, setOwnerOn] = useState(false);

  // Owner mode is reachable only by query flag (contract §14); never the default.
  useEffect(() => {
    try {
      setOwnerAvailable(new URLSearchParams(window.location.search).has("owner"));
    } catch {
      setOwnerAvailable(false);
    }
  }, []);

  async function start(req: StartRequest) {
    setProblem(null);
    setRequest(req);
    setRunning(true);
    const state = freshState();
    setRun({ ...state });

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: req.url, currentLevel: req.currentLevel, targetLevel: req.targetLevel }),
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
    } catch (err) {
      state.error = err instanceof Error ? err.message : String(err);
      setRun({ ...state });
    } finally {
      setRunning(false);
    }
  }

  function choose(option: { title: string; url: string | null }) {
    if (!option.url || !request) return;
    void start({ ...request, url: option.url });
  }

  function home() {
    if (running) return;
    setRun(null);
    setRequest(null);
  }

  return (
    <>
      <Header ownerAvailable={ownerAvailable} ownerOn={ownerOn} onToggleOwner={() => setOwnerOn((v) => !v)} onHome={home} />
      {run ? <RawRun run={run} running={running} choose={choose} /> : <Landing onStart={start} busy={running} problem={problem} />}
    </>
  );
}
