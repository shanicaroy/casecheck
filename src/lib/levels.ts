/**
 * Designer levels, contract §2: "where they are now (e.g. student / junior /
 * mid / senior) and where they want to be next. Both are optional; if absent,
 * the tool infers the current level and assumes the next step up."
 */
export const LEVELS = ["student", "junior", "mid", "senior", "lead"] as const;
export type Level = (typeof LEVELS)[number];

export function isLevel(value: unknown): value is Level {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value);
}

/** One step up. Lead is the top of the list, so a lead aiming higher stays lead. */
export function nextLevelUp(level: Level): Level {
  const i = LEVELS.indexOf(level);
  return LEVELS[Math.min(i + 1, LEVELS.length - 1)];
}

export interface LevelInputs {
  /** Stated at intake, when the fields exist. */
  currentLevel?: Level;
  targetLevel?: Level;
}

export interface ResolvedLevels {
  current: Level;
  currentSource: "stated" | "inferred" | "assumed";
  target: Level;
  targetSource: "stated" | "default_next_up";
  /** Written down whenever something was assumed rather than known. Contract §4.4. */
  assumptions: string[];
}

/**
 * Stated levels win. Otherwise the current level is the classify step's
 * seniority read; if that was unclear, junior is assumed (the audience, §2)
 * and the assumption is recorded. The target defaults to one step up.
 */
export function resolveLevels(inputs: LevelInputs, inferredSeniority: "junior" | "mid" | "senior" | "unclear"): ResolvedLevels {
  const assumptions: string[] = [];
  let current: Level;
  let currentSource: ResolvedLevels["currentSource"];
  if (inputs.currentLevel) {
    current = inputs.currentLevel;
    currentSource = "stated";
  } else if (inferredSeniority !== "unclear") {
    current = inferredSeniority;
    currentSource = "inferred";
  } else {
    current = "junior";
    currentSource = "assumed";
    assumptions.push("The current level could not be inferred from the page, so junior was assumed.");
  }

  let target: Level;
  let targetSource: ResolvedLevels["targetSource"];
  if (inputs.targetLevel) {
    target = inputs.targetLevel;
    targetSource = "stated";
  } else {
    target = nextLevelUp(current);
    targetSource = "default_next_up";
    assumptions.push(`No target level was given, so the review is framed toward ${target}, one step up from ${current}.`);
  }

  return { current, currentSource, target, targetSource, assumptions };
}
