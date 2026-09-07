/** The six steps, in order. No imports, so the page can use it without pulling in the pipeline. */
export type StepName = "fetch" | "classify" | "plan" | "checks" | "verify" | "report";
export const STEP_ORDER: StepName[] = ["fetch", "classify", "plan", "checks", "verify", "report"];
