/**
 * Every word shown on the page, in one place, so it can be edited without
 * touching components. Two passages are required by the product contract:
 * §9 (data handling, one sentence, before the link is submitted) and §10
 * (the limits statement, verbatim).
 */
export const copy = {
  name: "Case Check",
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
