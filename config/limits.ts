/**
 * Tunable numbers the contract says live in config (§5, §7 v0.2). Each can
 * be overridden per environment. The eval tunes them; code never hard-codes them.
 */
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const limits = {
  /** §7 Images: at most this many page images are captured and read per run. */
  imageCap: envInt("CASECHECK_IMAGE_CAP", 8),
  /** §5 Too-thin floor: below this many words of real narrative the tool declines. */
  thinFloorWords: envInt("CASECHECK_THIN_FLOOR_WORDS", 150),
  /** Page text handed to a model is cut here; the cut is declared. */
  maxTextChars: envInt("CASECHECK_MAX_TEXT_CHARS", 60_000),
  /** Images smaller than this are icons and avatars, not artefacts. */
  minImageWidth: 200,
  minImageHeight: 120,
};

export type Limits = typeof limits;
