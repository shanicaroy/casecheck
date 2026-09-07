/**
 * Reads a prompt file from prompts/ at run time. Kept separate from the code
 * so the wording can change without a code change. On Vercel the folder is
 * shipped with the function via next.config.mjs (outputFileTracingIncludes).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

export function loadPrompt(name: string): string {
  const file = path.join(process.cwd(), "prompts", `${name}.md`);
  return readFileSync(file, "utf8").trim();
}

export function loadRubric(): string {
  return readFileSync(path.join(process.cwd(), "rubric", "rubric.md"), "utf8").trim();
}
