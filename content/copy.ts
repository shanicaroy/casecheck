/**
 * Every word shown on the page, in one place, so it can be edited without
 * touching components. Two passages are required by the product contract:
 * §9 (data handling, one sentence, before the link is submitted) and §10
 * (the limits statement, verbatim).
 */
function lowerFirst(t: string): string {
  return t ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

export const copy = {
  name: "Case Check",

  // The landing view, from the UI reference v6. Sentence case; no em dashes; no all-caps labels.
  landing: {
    headerNote: "Built on Shanica Roy's evaluation criteria",
    ownerMode: "Owner mode",
    back: "Back",
    hero: {
      title: "Review your ux case study",
      placeholder: "Paste your case study link, I'll take it from here",
      start: "Start review",
      currentLevel: "Current level",
      targetLevel: "Targeting",
      trust: "Held only while the review runs. Never used to train anything.",
      how: "How Case Check works",
    },
    levels: { student: "Student", junior: "Junior", mid: "Mid-level", senior: "Senior", lead: "Lead" },
    brain: {
      photoAlt: "Photo of Shanica Roy",
      photoSlot: "Photo",
      /** Set to a path under public/ to show the real photo, for example "/shanica.jpg". */
      photoSrc: null as string | null,
      title: "This is how Shanica reviews a case study.",
      who: "Shanica Roy. UX lead, IRB-licensed researcher, 5,000+ designers mentored.",
      lede1:
        "Designers book review calls with Shanica. Most of a 45-minute call goes to the same narrative problems, and those can be caught by the criteria she teaches. Case Check runs that first pass so the call can start where a human is actually needed: taste, orchestration, how you think.",
      lede2:
        "It is not a fine-tuned model. It runs Shanica's written criteria, step by step, on your page, and shows you its reasoning and every assumption it made.",
      three: [
        { title: "Reads your page", body: "Fetches the case study, removes the duplicate text site builders add, and works out what kind of story it is." },
        { title: "Checks twelve things", body: "Every check quotes the sentence it rests on. No quote, no finding." },
        { title: "Verifies its own claims", body: "A second pass tries to break the first. Anything it can't find on your page is removed before you see it." },
      ],
      twelveSummary: "The twelve things it checks",
      weighted: "weighted",
      /** One line per rubric dimension, keyed by id. Names and weighting come from rubric/dimensions.json. */
      rubricLines: {
        A: "Does it start from a real problem in your own words, and can a reader see the before and the after?",
        B: "Remove the stage labels. Can a reader still follow the logic?",
        C: "Every persona or interview has to change a decision. Otherwise it's decoration.",
        D: "Time, tech, stakeholders, budget. A frictionless story is a red flag.",
        E: "What changed between versions, and why. Count matters less than reasoning.",
        H: "A real result, or an honest \"not launched yet\". Never a round number with nothing behind it.",
        F: "We chose this over that because. The alternative you rejected is the evidence of judgment.",
        G: "What you did, versus the team.",
        I: "Specific to this project, not \"I learned the value of research\".",
        J: "Can a hiring manager get the story in two minutes?",
        K: "A flag, never an accusation, raised with the specific evidence.",
        L: "Read at low confidence only. Judging taste from screenshots stays with a human.",
      },
      /** Short names for the landing list; the rubric file keeps the full ones. */
      rubricShortNames: { I: "Learnings", L: "Craft" } as Partial<Record<string, string>>,
      /** Order on the landing: the weighted six first, then the rest. */
      rubricOrder: ["A", "B", "C", "D", "E", "H", "F", "G", "I", "J", "K", "L"],
      wontSummary: "What it will not do",
      wontBody:
        "It judges the narrative. It does not assess visual craft in depth, accessibility, brand fit, or whether you'd get hired. It does not watch embedded videos or prototypes, and it tells you which ones it skipped. Its read of your level is an estimate to help you aim, not a judgment of you.",
    },
  },

  tagline:
    "Paste a link to a UX portfolio. Case Check finds the single weakest part of the case study's story, explains why, and gives one fix.",

  // Contract §9, one sentence, shown before the link is submitted.
  dataHandling:
    "Your portfolio content is held only while the review runs, is not stored afterwards unless you choose to save it, and is never used to train anything.",

  // Contract §10, verbatim.
  limits:
    "This tool judges the narrative of a case study. It does not assess visual craft in depth, accessibility, brand fit, or whether you'd get hired. It can be wrong, and it tells you how confident it is. Treat it as a first-pass coach, not a verdict.",

  // Honest build status. Remove when the full six-step flow is live.
  buildStatus:
    "Early build: all six steps run. The review below is shown in its raw form; the designed layout comes next.",

  form: {
    label: "Portfolio link",
    placeholder: "https://yourname.framer.website/case-study",
    submit: "Check",
  },

  // The running view, from the UI reference. Step names are the reference's, not the internal ones.
  running: {
    label: "Reviewing",
    elapsed: (mmss: string) => `${mmss} elapsed`,
    cancel: "Cancel",
    usually: (seconds: number) => `usually about ${seconds}s`,
    steps: {
      fetch: "Fetch the page",
      classify: "Read and understand",
      plan: "Decide where to look hardest",
      checks: "Check twelve things",
      verify: "Verify every claim",
      report: "Write the review",
    },
    stopped: "The review stopped here.",
    chooseIntro: "This link is a portfolio with several case studies. Choose one to review:",
    noLink: "(no link found on the page)",
    another: "Review another case study",
  },

  // Contract §5: a refusal always says why and what to do instead.
  declined: {
    heading: "Not enough to review yet",
    too_thin:
      "This page has too little case-study narrative for a fair read. Under the floor, the tool would be guessing, and a guess is worse than no review. If the full case study lives on another page, paste that link instead. If the story is in images, add the narrative as text so it can be read.",
    detailLabel: "What was found",
  },

  // The report view, from the UI reference, in the §14 order.
  report: {
    rail: {
      weakest: "The weakest part",
      fix: "The one fix",
      reads: "How it reads",
      inside: "What's inside",
      secondary: "Secondary issues",
      limits: "Limits and assumptions",
      how: "How Shanica evaluates",
    },
    untitled: "Your case study",
    verif: (made: number, verified: number, dropped: number) =>
      `${made} claims generated, ${verified} verified against your page, ${dropped} removed before showing you this.`,
    owner: {
      heading: "Owner view",
      step: "Step", model: "Model", tokens: "Tokens", time: "Time",
      none: "none",
      verifyModel: (model: string) => `code, then ${model}`,
      removed: "Removed before display",
      quoteNotFound: "Quote not found on page.",
      noSupport: "Quote present, but it does not support the claim as stated.",
      noEvidence: "No usable evidence was given.",
      imageMissing: "Cited image was not captured.",
      ranking: "Ranking inputs",
      trail: "Verification trail",
    },
    noWeakest: "No weak part was found among the storytelling dimensions the tool can judge.",
    noWeakestBody: "Every weighted dimension read as present on this page. The secondary notes below are what remains.",
    restsOnImage: (n: number, note: string) => `Rests on image ${n}: ${note}`,
    notOnThisPage: "This may live in the fuller version linked from the page, which was not read. On this page it is absent.",
    whyMatters: "Why it matters",
    whyFirst: "Why it comes first",
    reasoning: {
      summary: "See the reasoning",
      dimension: "Dimension",
      plan: "Plan",
      question: "Question asked",
      confidence: "Confidence",
      verified: "Verified",
      pressed: (reason: string) => `Pressed hard, because ${lowerFirst(reason)}`,
      normal: (reason: string) => `Normal depth. ${reason}`,
      light: (reason: string) => `Light. ${reason}`,
      noQuestion: "No specific question; checked at the planned depth.",
      quoteFound: "Quote found on the page, character for character.",
      quotePartial: "Quote found on the page. It partially supports the claim, so confidence was lowered one level.",
      imageRead: (n: number) => `Rests on image ${n}, which was read. At most medium confidence.`,
    },
    fixFrame: (target: string) => `Framed for someone targeting a ${target} role.`,
    noFix: "Nothing to change at this level of the read.",
    readsAs: (level: string) => `Reads as ${level}.`,
    confidence: (c: string) => `Confidence: ${c}`,
    readsEstimate: "This is an estimate to help you aim, not a judgment of you.",
    nothingMissing: (target: string) => `Nothing on this page was found missing toward ${target}.`,
    insideTitle: "What the case study contains, and what it doesn't.",
    part: "Part", status: "Status", evidence: "Evidence",
    statusWord: { present: "Present", weak: "Weak", missing: "Missing" },
    noEvidence: "Not found on the page.",
    secondaryTitle: "Worth fixing after the one above.",
    secondaryNone: "Nothing else stood out.",
    couldNot: "What it couldn't judge",
    assumptions: "Assumptions that shaped this review",
    noAssumptions: "None. The page was read as given.",
    howTitle: "The criteria this review used.",
    howLede: "The same twelve dimensions Shanica teaches. Weighted ones are the most likely to be the weakest part.",
    howLines: {
      A: "Does it start from a real problem in your own words? For a redesign, can a reader see what existed, what was wrong, and what it is now? For a new product, can they follow the move from ambiguity to a defined problem?",
      B: "Remove the stage labels. Can a reader still follow the logic? A framework is fine as scaffolding; the reasoning underneath has to be visible.",
      C: "Every persona, journey map, or interview has to trace to a decision it changed. If it's never referenced again, it's decoration.",
      D: "Time, technical limits, stakeholders, budget, legacy systems. Something should have gone wrong. A frictionless story is a red flag.",
      E: "What changed between versions, and why. The number of iterations matters less than whether the reasoning is visible.",
      H: "A real metric, a qualitative result, a shipped state, or an honest \"not launched yet\". Inflated or unverifiable claims are the one thing that makes a reviewer stop reading.",
      F: "\"We chose this over that because.\" The alternative you rejected is the evidence of judgment.",
      G: "What you did, versus the team. Especially on group and agency projects.",
      I: "Specific to this project. What you'd do differently, not what any designer would say.",
      J: "Can a hiring manager get the story in two minutes? Is the key decision buried two thirds of the way down?",
      K: "Generic personas, invented quotes, stock insights, uniform rhythm. Raised as a flag with the evidence, never as an accusation.",
      L: "Read at low confidence only, and never chosen as the weakest part. Judging taste from screenshots stays with a human.",
    },
    howOrder: ["A", "B", "C", "D", "E", "H", "F", "G", "I", "J", "K", "L"],
    howShortNames: { I: "Learnings", L: "Craft" } as Partial<Record<string, string>>,
    rerun: "Re-run after your edits",
    another: "Review another case study",
    stopsTitle: "Where Case Check stops",
    stopsBody: "Craft, taste, product instinct, and how you think in conversation are outside what this system can reliably judge. A review with Shanica starts where this one ends.",
    request: "Request a review with Shanica",
    /** Set to the booking link. Until then the link is inert. */
    requestHref: "#",
  },

  // Contract §14.8: the claims-made vs claims-surviving count, in one sentence.
  verify: {
    heading: "How sure it is",
    sentence: "It made {made} claims and could verify {surviving} against your page; the {dropped} it couldn't were dropped.",
    sentenceNoneDropped: "It made {made} claims and could verify all of them against your page.",
    droppedHeading: "Dropped claims (owner view)",
    downgradedHeading: "Confidence lowered on verification",
    stage: { checks: "no usable evidence", quote_not_found: "quote not found on the page", image_not_found: "image not captured", does_not_support: "evidence does not support the claim" },
    failHeading: "Couldn't verify the findings",
  },

  checks: {
    heading: "The twelve checks",
    verdict: { present: "present", weak: "weak", missing: "missing", not_on_this_page: "not on this page" },
    dropped: "dropped",
    confidence: "confidence",
    answer: "Answer",
    levelGap: "To read as the target",
    imageEvidence: "Image",
    couldNotJudge: "Couldn't judge",
    imagesRead: "What the images added",
    unverified: "These findings have not been verified against the page yet (step 5).",
    failHeading: "Couldn't run the checks",
  },

  plan: {
    heading: "Where the review will look hardest",
    readsAs: "reads as",
    aimingFor: "aiming for",
    assumed: "assumed",
    stated: "stated",
    emphasis: { press_hard: "press hard", normal: "normal", light: "light" },
    failHeading: "Couldn't plan the checks",
  },

  classify: {
    heading: "What kind of page this is",
    chooseHeading: "Which case study should be reviewed?",
    chooseBody: "This link is a portfolio with several case studies. Pick one and the check runs again on that page.",
    noLink: "no link found on the page",
    inventoryHeading: "What's on the page",
    assumptionsHeading: "Assumptions the tool made",
    externalLinks: "Links to fuller case studies elsewhere (not read)",
    failHeading: "Couldn't classify this page",
  },

  result: {
    okHeading: "What the tool sees",
    failHeading: "Couldn't fetch this page",
    textHeading: "Visible text, duplicates removed",
  },
} as const;
