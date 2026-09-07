/**
 * Every word shown on the page, in one place, so it can be edited without
 * touching components. Two passages are required by the product contract:
 * §9 (data handling, one sentence, before the link is submitted) and §10
 * (the limits statement, verbatim).
 */
export const copy = {
  name: "Case Check",

  // The landing view, from the UI reference. Sentence case; no em dashes; no all-caps labels.
  landing: {
    headerNote: "Built on Shanica Roy's evaluation criteria",
    ownerMode: "Owner mode",
    hero: {
      title: "Review your UX case study.",
      lede: "Case Check finds the weakest part of your story and tells you the one thing to fix first.",
      placeholder: "Paste your case study link",
      start: "Start review",
      currentLevel: "Current level (optional)",
      targetLevel: "Level you're targeting (optional)",
      hint: "These only change the expectations used during the review.",
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

  steps: {
    fetch: "Fetch the page",
    classify: "Read and classify",
    plan: "Plan the checks",
    checks: "Run the rubric checks",
    verify: "Self-verify every claim",
    report: "Report",
    notBuilt: "not built yet",
  },

  // Contract §5: a refusal always says why and what to do instead.
  declined: {
    heading: "Not enough to review yet",
    too_thin:
      "This page has too little case-study narrative for a fair read. Under the floor, the tool would be guessing, and a guess is worse than no review. If the full case study lives on another page, paste that link instead. If the story is in images, add the narrative as text so it can be read.",
    detailLabel: "What was found",
  },

  // Contract §14: the review, in this order.
  report: {
    weakest: "The weakest part",
    restsOn: "Rests on",
    whyWeak: "Why it's weak",
    whyOutranks: "Why it outranks the others",
    trustProblem: "a trust problem",
    noWeakest: "No weak part was found among the storytelling dimensions the tool can judge.",
    fix: "The one fix",
    fixFrame: "To read as {target}",
    readsAs: "Reads as",
    aimingFor: "aiming for",
    missingToward: "To read as {target}, this is what's missing",
    nothingMissing: "Nothing on this page was found missing toward that level.",
    inventory: "What's on the page",
    secondary: "Also, smaller",
    couldNotJudge: "Couldn't judge",
    assumptions: "Assumptions the tool made",
    howSure: "How sure it is",
    ranking: "Ranking inputs (owner view)",
    failHeading: "Couldn't write the review",
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
