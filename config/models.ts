/**
 * Which Claude model runs which tier. Contract §7 "Cost routing": fetch,
 * classify and plan run on a cheaper, faster model; checks and self-verify on
 * the stronger one. The cost difference is recorded per run.
 *
 * Change the IDs here, or override per environment with
 * CASECHECK_CHEAP_MODEL / CASECHECK_STRONG_MODEL.
 */
export const models = {
  cheap: "claude-sonnet-5",
  strong: "claude-opus-5",
} as const;

export type Tier = keyof typeof models;
