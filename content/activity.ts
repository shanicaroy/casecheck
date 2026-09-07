/**
 * The sub-activity lines shown under each step while a review runs. Every
 * line is either the step's fixed statement of what it is doing, or a fact
 * the pipeline just produced. Nothing here is timed or simulated.
 */
export const activity = {
  active: {
    fetch: "Fetching the page",
    classify: "Reading the case study end to end",
    plan: "Checking the structure against the evaluation criteria",
    checks: "Checking each dimension against your page",
    verify: "Looking for every quoted sentence on your page",
    report: "Choosing the weakest part and writing the fix",
  },
  fetch: {
    captured: (words: number) => `Page captured: ${words.toLocaleString()} words of narrative after removing duplicates`,
    found: (links: number, images: number, embeds: number) =>
      `Found: ${links} link${links === 1 ? "" : "s"}, ${images} image${images === 1 ? "" : "s"}${embeds ? `, ${embeds} embedded video${embeds === 1 ? "" : "s"}/prototype${embeds === 1 ? "" : "s"}` : ""}`,
    following: (host: string) => `Following the link to the case study on ${host}`,
  },
  classify: {
    caseStudy: (title: string) => `Case study: ${title}`,
    shape: (problemType: string, present: number, total: number) =>
      `Story shape: ${problemType === "revamp" ? "a redesign" : problemType === "zero_to_one" ? "a new product" : "type unclear"}, ${present} of ${total} narrative parts present`,
    several: (n: number) => `Found ${n} case studies on this page`,
    nothing: "No case study found on this page",
  },
  plan: {
    pressing: (names: string[]) => (names.length ? `Pressing hardest on ${joinNames(names)}` : "Checking all twelve at normal depth"),
  },
  checks: {
    images: (n: number, total: number) => `Reading ${n} of ${total} image${total === 1 ? "" : "s"} for content the text doesn't carry`,
    findings: (withEvidence: number) => `${withEvidence} of 12 findings carry a quote or an image`,
  },
  verify: {
    counts: (made: number, surviving: number) =>
      `${made} claims made, ${surviving} found on the page, ${made - surviving} removed`,
  },
  declined: {
    too_thin: (words: number, floor: number) => `${words} words of case-study narrative found; ${floor} needed for a fair read`,
  },
} as const;

function joinNames(names: string[]): string {
  const lower = names.map((n) => n.charAt(0).toLowerCase() + n.slice(1));
  if (lower.length === 1) return lower[0];
  return `${lower.slice(0, -1).join(", ")}, and ${lower[lower.length - 1]}`;
}
