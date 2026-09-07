/**
 * Per-step timings from past runs, for the running view's "usually about Ns".
 *
 * Only durations are stored: no URL, no text, no findings (contract §9).
 * Backed by Upstash Redis over REST when UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are set (added by the Vercel Marketplace), else an
 * in-memory list that lives as long as the server process. The last 50
 * timings per step are kept. Until five runs exist for a step, the view
 * shows the reference's default for it.
 */
import type { StepName } from "../pipeline/steps";
import { STEP_ORDER } from "../pipeline/steps";

/** From the UI reference. Used until five logged timings exist for a step. */
export const DEFAULT_SECONDS: Record<StepName, number> = { fetch: 5, classify: 8, plan: 6, checks: 30, verify: 10, report: 8 };
export const MIN_RUNS = 5;
const KEEP = 50;

export interface StepTiming {
  step: StepName;
  seconds: number;
  /** How many logged runs the figure rests on; 0 means the default is showing. */
  runs: number;
}

interface Store {
  push(step: StepName, ms: number): Promise<void>;
  list(step: StepName): Promise<number[]>;
}

const memory = new Map<StepName, number[]>();
const memoryStore: Store = {
  async push(step, ms) {
    const arr = memory.get(step) ?? [];
    arr.unshift(ms);
    memory.set(step, arr.slice(0, KEEP));
  },
  async list(step) {
    return memory.get(step) ?? [];
  },
};

function redisStore(url: string, token: string): Store {
  const call = async (...cmd: (string | number)[]) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(cmd),
    });
    if (!res.ok) throw new Error(`Timing store answered ${res.status}.`);
    return (await res.json()) as { result: unknown };
  };
  const key = (step: StepName) => `casecheck:timings:${step}`;
  return {
    async push(step, ms) {
      await call("LPUSH", key(step), ms);
      await call("LTRIM", key(step), 0, KEEP - 1);
    },
    async list(step) {
      const { result } = await call("LRANGE", key(step), 0, KEEP - 1);
      return Array.isArray(result) ? result.map(Number).filter((n) => Number.isFinite(n)) : [];
    },
  };
}

function store(): Store {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? redisStore(url, token) : memoryStore;
}

/** Record the steps that ran. Never throws: a timing that fails to save is not a review failure. */
export async function recordTimings(steps: { step: StepName; durationMs: number }[]): Promise<void> {
  const s = store();
  for (const { step, durationMs } of steps) {
    try {
      await s.push(step, durationMs);
    } catch {
      /* ignore */
    }
  }
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function typicalTimings(): Promise<StepTiming[]> {
  const s = store();
  return Promise.all(
    STEP_ORDER.map(async (step) => {
      let values: number[] = [];
      try {
        values = await s.list(step);
      } catch {
        values = [];
      }
      if (values.length < MIN_RUNS) return { step, seconds: DEFAULT_SECONDS[step], runs: values.length };
      return { step, seconds: Math.max(1, Math.round(median(values) / 1000)), runs: values.length };
    }),
  );
}
