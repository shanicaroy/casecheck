/**
 * Words for the revamped views (running, clarify, declined, report, how it
 * works). Same rules as copy.ts: sentence case, no em dashes, no all-caps
 * labels, errors say what happened and what to do next.
 */
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export const ui = {
  header: { newReview: "New review", back: "Back", print: "Print" },

  bubble: {
    pasted: (words: number, shots: number) => `Pasted text, ${plural(words, "word")}${shots ? `, ${plural(shots, "screenshot")}` : ""}`,
    levels: (current: string | null, target: string | null) =>
      current && target ? `${current}, targeting ${target.toLowerCase()}` : target ? `Targeting ${target.toLowerCase()}` : current ? current : "",
  },

  running: {
    reviewingFallback: "Reviewing your case study",
    reviewing: (title: string) => `Reviewing ${title}`,
    step: (n: number) => `Step ${n} of 6.`,
    total: (seconds: number) => (seconds < 90 ? "Usually about a minute in total." : `Usually about ${Math.round(seconds / 60)} minutes in total.`),
    elapsed: "elapsed",
    took: (seconds: number) => `${seconds}s`,
    live: (seconds: number, usual: number) => `${seconds}s, usually about ${usual}s`,
    usually: (usual: number) => `usually about ${usual}s`,
    safe: "Nothing is kept after the review. Safe to leave this tab in the background.",
    cancel: "Cancel review",
    slowTitle: "Taking longer than usual. Still working.",
    slowBody: (ago: number, usual: number) => `Last update ${plural(ago, "second")} ago. This step usually takes about ${usual}s.`,
    silentTitle: "No word from the server for 30 seconds.",
    silentBody: "The connection may have dropped. Nothing was stored, so trying again starts clean.",
    chipsChecking: "All twelve are checked together. Outlined: where the plan pressed hardest.",
    chipsToVerify: "Still to be verified in the next step",
    chipsVerified: "Checked against your page",
    readyHeadline: "Your review is ready",
    readySub: (verified: number, made: number, dropped: number) =>
      dropped ? `${verified} of ${made} claims verified against your page. ${dropped} removed before you see it.` : `All ${made} claims verified against your page.`,
    readyTitle: (name: string) => `The weakest part is ${name.charAt(0).toLowerCase()}${name.slice(1)}.`,
    readyNone: "No weak part stood out among what it can judge.",
    readyBody: (target: string) => `One fix, framed for a ${target.toLowerCase()} role.`,
    readyCta: "Read the review",
    stoppedTitle: "The review stopped here.",
    stoppedBody: "This is on Case Check's side, not your page's. Trying again usually works.",
    retry: "Try again",
  },

  /** Short names for the running view's twelve chips, in the rubric's display order. */
  chips: {
    A: "Problem framing", B: "Thinking, not process", C: "Research", D: "Constraints", E: "Iteration", H: "Outcome and honesty",
    F: "Decisions", G: "Role clarity", I: "Learnings", J: "Readability", K: "AI signals", L: "Craft, light read",
  } as Record<string, string>,
  chipOrder: ["A", "B", "C", "D", "E", "H", "F", "G", "I", "J", "K", "L"],

  status: { present: "Present", weak: "Weak", missing: "Missing" },

  clarify: {
    title: (n: number) => `This link holds ${n} case studies. Which one should I review?`,
    body: "One at a time keeps the read fair. You can come back for the others.",
    pick: "Review this one",
    noLink: "No link found on the page, so this one can't be opened from here.",
    direct: "Have the direct link to one case study?",
    directCta: "Paste it instead",
  },

  declined: {
    blocked: (host: string) => ({ title: `${host} blocks automated readers, so I can't see this case study.`, body: "A guess would be worse than no review. Paste the text instead, and add screenshots if part of the story lives in images." }),
    login: { title: "This page needs a login, so I can't see it.", body: "Make the page public and try the link again, or paste the text below." },
    dead: { title: "I couldn't open this link.", body: "Check the address, or paste the text below." },
    timeout: { title: "The page took too long to load.", body: "Try the link again in a moment, or paste the text below." },
    notHtml: { title: "This link isn't a web page, and PDFs aren't read yet.", body: "Paste the case study's text below instead." },
    invalid: { title: "That doesn't look like a web link.", body: "Links start with https://. Or paste the text below." },
    thin: (words: number, floor: number) => ({
      title: "There's too little case-study narrative here for a fair read.",
      body: `${plural(words, "word")} found; about ${floor} are needed. If the full story is on another page, try that link. If it lives in images, paste the text.`,
    }),
    notCase: { title: "This doesn't look like a case study.", body: "Try a link to one case study, or paste its text below." },
    pasteLabel: "Paste the text",
    pasteTag: "Most accurate",
    pastePlaceholder: "Paste your case study here, headings and all.",
    count: (words: number, floor: number) => (words >= floor ? `${plural(words, "word")}. Enough for a fair read.` : `${plural(words, "word")}. About ${floor} needed for a fair read.`),
    shotsLabel: "Add screenshots",
    shotsTag: (cap: number) => `Optional, up to ${cap}`,
    shotsDrop: "Drop screenshots here",
    shotsChoose: "Choose files",
    shotsNote: "Text inside images is read. Visual craft is not judged.",
    shotsCount: (n: number) => `${plural(n, "screenshot")} added`,
    shotsClear: "Remove",
    shotsTooBig: "Those screenshots are too large together. Try fewer, or smaller ones.",
    tip: "Framer, Notion, Medium, and personal sites work straight from a link.",
    submit: "Review pasted text",
    another: "Try another link",
  },

  report: {
    verifiedStrong: (verified: number, made: number) => `${verified} of ${made} claims verified against your page.`,
    verifiedRest: (dropped: number) => (dropped ? ` ${plural(dropped, "claim was", "claims were")} removed before you saw this.` : ""),
    verifiedAll: (made: number) => `All ${made} claims verified against your page.`,
    pastedHost: "Pasted text",
    storyShape: { revamp: "A redesign", zero_to_one: "A new product", unclear: "" } as Record<string, string>,
    foundOnPage: "Found on your page",
    fixTag: "Doable this week",
    confidence: { low: "Low confidence", medium: "Medium confidence", high: "High confidence" } as Record<string, string>,
    readsUnclear: "Not enough on this page to estimate a level",
    readsLabel: "Reads as",
    targetLabel: "Your target",
    ladderLabel: (reads: string, target: string) => `Level ladder: reads as ${reads}, target ${target}`,
    feedbackQ: "Was this the right call?",
    feedbackYes: "Yes",
    feedbackNo: "Not quite",
    feedbackThanks: "Thanks. That goes into how Case Check is evaluated.",
    lightRead: "Light read",
    footer: "Case Check runs Shanica Roy's written criteria, step by step. It is not a fine-tuned model.",
  },

  how: {
    cta: "Review your case study",
    stepsTitle: "What happens after you paste a link",
    stepsLede: "Six steps, each shown to you live as it runs. About a minute in total.",
    steps: [
      { name: "Fetch the page", body: "Reads your case study and removes the duplicate text site builders add." },
      { name: "Read and understand", body: "Works out what kind of story it is. If the link holds several case studies, it asks which one." },
      { name: "Decide where to look hardest", body: "Commits to where it will press before it looks, shaped by the level you're aiming for." },
      { name: "Check twelve things", body: "Every finding quotes the sentence it rests on. No quote, no finding." },
      { name: "Verify every claim", body: "Searches your page for every quote, word for word. Anything it can't find is removed before you see it." },
      { name: "Write the review", body: "One weakest part, one fix, and everything it couldn't judge." },
    ],
    twelveTitle: "The twelve things it checks",
    twelveLede: "Weighted ones are the most likely to be the weakest part.",
    wontTitle: "What it will not do",
    dataTitle: "What happens to your page",
    closeTitle: "Ready when you are.",
    closeBody: "Paste one case study link. About a minute.",
  },
};

/** Hosts known to block automated readers. Caught before a run is started. */
export const READER_BLOCKING_HOSTS: Record<string, string> = { "behance.net": "Behance" };
