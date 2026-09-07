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
    "Early build: right now this page runs steps 1 to 3 of 6 (fetch, classify, plan) and shows you exactly what the tool sees and where it will look hardest. The review itself is not built yet.",

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
