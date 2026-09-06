/**
 * Text clean-up applied to whatever the browser gives us.
 *
 * Why this exists (product contract §8, worked example 1):
 * Framer serves each paragraph up to three times, once per breakpoint. Most of
 * those copies are hidden with CSS and never reach `innerText`, but not all
 * site builders are that tidy. If duplicates leak through, a later step would
 * invent a "redundancy" weakness that the designer never wrote. So we collapse
 * identical lines before anything downstream sees the text.
 */

/** Collapse whitespace, drop empty lines, keep the first copy of any repeated line. */
export function cleanText(raw: string): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (line === "" || seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }
  return lines.join("\n");
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
