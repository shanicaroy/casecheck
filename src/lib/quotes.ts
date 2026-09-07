/**
 * Does a quote literally appear in the source text?
 *
 * Deterministic, no model. Both sides are normalised the same way before
 * matching so a genuine quote is not lost to punctuation the browser or the
 * model changed: whitespace runs (including line breaks and non-breaking
 * spaces) collapse to one space; curly quotes become straight; en/em/figure
 * dashes and hyphen variants become a hyphen; the ellipsis character becomes
 * three dots. Letter case is kept: a quote is verbatim or it is not.
 */
export function normaliseForMatch(s: string): string {
  return s
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐‑‒–—―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[\s  -​  　]+/g, " ")
    .trim();
}

export function quoteInSource(quote: string, source: string): boolean {
  const q = normaliseForMatch(quote);
  if (q === "") return false;
  return normaliseForMatch(source).includes(q);
}
