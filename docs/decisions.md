# Decision log

Contract §12: anything cut or chosen is written up as a decision with a reason, not silently dropped.
Newest at the bottom.

## 2026-09-06 · Slice one

**Agent logic lives in plain TypeScript, separate from any web page.**
`src/steps/` holds the six steps as functions with typed inputs and outputs. No web framework yet.
Reason: the contract's open decision (§13) is "thin custom page vs. no-code wrapper". Keeping the
pipeline framework-free means either answer can wrap it later without rewriting the steps, and each
step can be run and tested from the terminal on its own.

**Fetch uses a real headless browser (Playwright + Chromium), not a plain HTTP request.**
Reason: Notion, Framer and Behance render content with JavaScript; a plain request returns an empty
shell. The contract also requires screenshots for vision in step 4, and a browser is the only way to
get those. Cost of this choice: wherever the tool is hosted must be able to run Chromium. That
hosting decision is deferred until the pipeline works end to end.

**Fetch reports facts, never judgements.**
It returns visible text, title, status, word count and image count, or a transport-level failure
reason (`invalid_url`, `unreachable`, `timeout`, `http_error`, `not_html`). Deciding that a page is
"empty", "images only", "not a portfolio", or wording the user-facing error messages (§7) belongs to
later steps and to Shanica.

**Duplicate lines are collapsed at fetch time.**
Reason: contract §8, worked example 1, lesson (3). Framer serves paragraphs once per breakpoint.

**PDF links are reported as `not_html`, not read.**
Reason: whether v1 supports PDF input is an open decision (§13). Fetch surfaces the fact; nothing
else is assumed.

**Lives in its own repository, `shanicaroy/casecheck`.**
Slice one was first built inside the portfolio repo because the build session could only reach
that one. It was moved here unchanged the same day, and the copy in the portfolio was removed.
Reason: a separate product with its own dependencies and its own domain should not share a build
with the portfolio (the shared build broke the portfolio's Vercel deploy once already).

## 2026-09-06 · Hosting

**Case Check is its own Vercel project, served at `casecheck.uxpective.com`.**
Set up by Shanica in the Vercel dashboard (the build session has no Vercel access). A subdomain
rather than the bare `uxpective.com`, because the bare domain serves the UXPective site and Vercel
moves a domain between projects rather than sharing it. The domain currently returns 404: slice one
has no web page, so Vercel deploys nothing. The page is slice two.

## 2026-09-06 · Slice two: the page

**Thin custom page, built with Next.js in this repo.** Closes the §13 open decision "thin custom
page vs. no-code wrapper". Reason: the Vercel project already existed, Next.js is what the
portfolio uses, and the agent steps stay framework-free in `src/` with the page as a wrapper.

**The page runs step 1 only and shows the raw result.** The review is not built, and the page says
so in a build-status line (`content/copy.ts`). Reason: contract §4 item 4, no silent guessing,
applies to the build too. Nothing on the page implies a capability that doesn't exist yet.

**Page copy lives in `content/copy.ts`, not in components.** Same principle as rubric/ and
prompts/: words Shanica may change should not require touching code. The §9 data-handling sentence
and the §10 limits statement (verbatim) are there.

**On Vercel the browser is `@sparticuz/chromium`, a slim Linux Chromium shipped inside the
function.** Alternatives considered: a hosted browser service (extra bill, extra secret) or running
the agent on a separate server (two deployments). Chosen because it keeps one repo, one deploy, no
cost. Known costs: the first request after a cold start unpacks Chromium (measured ~3s locally),
and the function is capped at 60s. `src/lib/browser.ts` is the only file that knows which Chromium
runs where.

**Failure reasons are still shown as raw codes on the page** (`http_error`, `not_html`, …). The
designed error states of §7, with their wording and next steps, are a later slice and Shanica's copy.

## 2026-09-06 · Ambiguity at intake (contract §5)

**When the link is a whole portfolio with several case studies and no single one is indicated, the
tool asks which one to review. It does not take the first.** Decided by Shanica. Reason: taking the
first and saying so is allowed by §5, but a review of the wrong case study wastes the designer's one
run and the ask costs one click. Step 2 (Classify) is built to this: it lists the case studies it
found and stops for a choice. A link that already points at one case study page skips the question.

## 2026-09-06 · First live run of step 1

**Deployed fetch works.** work.shanicaroy.com fetched on Vercel in 4.8s: 226 words, status 200,
title captured, navigation and hero text visible. Two hosting faults were found and fixed on the
way, both worth remembering: the Vercel project needed the Next.js framework declared in the repo
(`vercel.json`), and Vercel's file tracer had left out a file Playwright reads by a runtime-built
path (`browsers.json`), fixed by listing the whole package in `next.config.mjs`. The `/api/health`
route was added to diagnose that and stays as a permanent check.

**Learning: `imageCount` undercounts.** The live run reported 0 images for a page that visibly has
cover artwork. The count only sees `<img>` elements; this portfolio draws its covers as inline SVG,
and other sites use CSS background images. Step 2 must not treat a low image count as proof of a
text-only page. Widening the count (SVG, `<picture>`, backgrounds) is a small change for a later
slice, or screenshots make the question moot once vision arrives in step 4.

## 2026-09-07 · Slice two of the evaluation: step 2, Classify

**Models: `claude-sonnet-5` for the cheap tier, `claude-opus-5` for the strong tier.** Set in
`config/models.ts`, overridable per environment. Contract §7 requires a cheap tier for
fetch/classify/plan and a strong one for checks/self-verify, with the cost difference recorded.
Every model call returns model, tokens and time, and the run log keeps them per step (eval sheet §7).

**Model answers are constrained to a schema, never parsed from prose.** Each step declares the exact
shape of the answer it needs (a Zod schema next to the step's code) and the API is asked for
structured output matching it. An answer that breaks the shape is rejected as `invalid_output`.
Reason: contract §7 "Structured output"; also, typed data is what the later steps and the eval log
need.

**Prompt text lives in `prompts/classify.md`; the answer's shape lives in `src/steps/classify.ts`.**
The wording is Shanica's to edit without code. The shape is code because the code that reads it
depends on it.

**Which case study is reviewed is a rule in code, not a model choice.** Single case study page:
that one. Index with one case study: that one, logged as assumed. Index with several: stop and ask
(decision of 2026-09-06). Not a portfolio or too little content: nothing selected. Reason: a rule in
code cannot drift between runs; the eval sheet §7 needs "asked or assumed" recorded reliably.

**Page text is capped at 60,000 characters before the model sees it, and the cap is declared.**
Enough for any single case study; protects cost and the cheap model's context. When it triggers,
the classification carries `textTruncated: true` so later steps can say so.

**The fetch step now also captures links (visible text + href).** Needed so classify can name
which page each case study lives on (the "ask which one" flow) and so the "full case study
elsewhere" link the contract warns about can be detected rather than guessed.

**Steps stream to the page as newline-delimited JSON events.** One event per step transition,
written as it happens, so the step list on the page updates live and there is never a blank
spinner (contract §7). The same event stream is what the terminal command prints.

## 2026-09-07 · Contract v0.2 read; step 3, Plan

**Classify inventory widened to the nine parts of contract §7 v0.2, and the seniority read now
carries its own confidence.** Done in this slice rather than slice 4 because the plan step reads
the inventory: constraints, tradeoffs and role clarity each drive a dimension's emphasis.

**Levels resolve in code, in one place (`src/lib/levels.ts`).** Stated levels win. Otherwise the
current level is the classify step's seniority read; if that read was unclear, junior is assumed
(the audience, §2) and written down. The target defaults to one step up and that default is
written down too. The pipeline and the API already accept `currentLevel` and `targetLevel`, so the
intake fields (§14) can be added to the page later without touching any step.

**The plan is data step 4 consumes: twelve dimensions, A–L in order, each with an emphasis
(press_hard / normal / light), a reason, and, when press_hard, the specific question to answer for
this case.** The model proposes it from `prompts/plan.md` with the rubric appended; code enforces
what may not drift: all twelve present and in order, L always light (§8 scope note), no question no
press (press_hard without a question is downgraded to normal). Every override is recorded as an
adjustment for the owner view.

**Emphasis heuristics live in the prompt, not in code.** How a revamp presses A, how a present
research section presses C on "which decision did it change", how the target level shifts the bar
(toward mid: thinking and iteration; toward senior: tradeoffs, constraints, ownership) are rubric
judgements and belong in the file Shanica edits. Code owns only the invariants above.

**Cheap tier at medium effort for the plan.** Classification was low effort; the plan is a
judgement about where to look and is worth a little more, and it is still a fraction of the cost
of the check step.

**Runs with nothing to review stop after classify.** Not a portfolio, too little content, or no
case study selected: the pipeline stops before planning. The designed refusal message for each of
those cases (§5, §7 error states) is a later slice.

## 2026-09-07 · Step 4, Run checks, with the four v0.2 engine decisions

**Images are captured as element screenshots, not by downloading image files.** The browser
screenshots each qualifying element as it renders, so inline SVG covers and CSS background images
count, which fixes the "0 images" undercount from the first live run. Candidates must be at least
200×120 and outside nav/header/footer. Priority: fewest narrative words within ~500px above and
below first (thin-text-adjacent, §7), larger first on ties; the chosen ones are then shown in page
order. JPEG at quality 70. Cap `limits.imageCap` = 8. Bytes live in memory for the run and are
stripped from every event before it reaches the browser (§9, §14).

**Embedded media is detected and counted, never analysed.** iframes, embeds, objects and video
elements, with YouTube, Loom and Figma recognised by source. The count becomes one line in
"couldn't judge", added by code so it cannot be forgotten by the model.

**The too-thin floor is judged in the pipeline, after classify and before plan.** After classify,
not after fetch, because an index page has little narrative of its own and must still reach the
"which case study?" question; measured on the page that will actually be reviewed. Before plan, so
no strong-model call (and no plan call) is spent on a page that will be declined. Narrative words
are text outside nav/header/footer/aside, de-duplicated. `limits.thinFloorWords` = 150, tuned by
the eval. Below it the run ends with a `declined` event carrying the count and the floor; the
wording is in `content/copy.ts` and says why and what to do instead (§5).

**An index page with exactly one case study is followed to that page, one hop.** The decision of
2026-09-06 said "take that one, logged". Reviewing the index page's own text would review the wrong
thing, so the pipeline fetches and classifies the case study's URL and continues from there, and
the run log records `followedTo`.

**Findings are twelve typed objects, A–L in order, and code enforces what the model may not
break.** No quote, no finding: a quote-based finding with an empty quote, or an image-based one
with no valid image index, is kept in place with status `dropped` and a reason, never removed
from the array and never invented. A finding the model omits is likewise recorded as dropped.
Image-grounded findings are capped at medium confidence. `not_on_this_page` is only available
when classify found a fuller version elsewhere; otherwise it becomes `missing`, recorded. L is
always low confidence and never eligible as the weakest part; K, a cross-cutting flag, is never
eligible either. Eligibility comes from `rubric/dimensions.json`. Every override is an adjustment
in the result for the owner view.

**Level guidance is tied to a finding by structure.** `level_gap` lives inside each finding and
is only kept for weak/missing verdicts, so the §4.2 rule (no level advice that is not tied to a
specific finding on this case) is enforced by shape, not by hoping the model complies.

**The plan is consumed in the prompt's user message, not in the system prompt.** Each dimension's
line says its emphasis, and a press_hard line carries the plan's question verbatim after "Answer
explicitly:". Changing how hard a dimension is pressed is therefore a plan change, not a prompt
change, and the checks prompt stays stable for caching.

**Strong tier, high effort, vision.** `claude-opus-5` at effort high with the images as content
blocks after the text. The API route allows 300s and the client 240s, because a cold start plus a
twelve-finding answer with images can take a couple of minutes.

**Still open (for slice 6): which dimensions may be named the weakest part.** The slice 4 brief
said only ★ dimensions A–E; the contract's worked example names H. For now only K and L are
ineligible; the rest wait for Shanica's call.

## 2026-09-07 · Step 5, Self-verify: code first, model second

**Pass 1 is code and cannot be argued with.** A quote-based finding survives only if its quote
literally appears in the de-duplicated page text; an image-based one only if the cited image was
captured. No model is consulted and there is no appeal. Reason: this is the check that catches
failure #1 in §4 (invented specifics), and a model asked "is this quote real?" can be persuaded by
a plausible quote. String matching cannot.

**Matching normalises punctuation, not words.** Whitespace runs, line breaks and non-breaking
spaces collapse to one space; curly quotes become straight; en, em and figure dashes become a
hyphen; the ellipsis character becomes three dots. Letter case is kept. Reason: browsers and models
both change punctuation; a real quote must not be lost to that, and a changed word must still fail.

**Pass 2 asks the cheap model one question per surviving finding, in parallel (four at a time).**
"Does this evidence support this claim as stated?" with the verdict, the reasoning, and the exact
quote (or the image, attached). supports → unchanged; partially_supports → confidence down one
level with the reason appended; does_not_support → dropped with the reason. One question per
finding, rather than one call for all twelve, so findings cannot borrow support from each other.

**Claims made counts what the check model asserted, including claims it made without usable
evidence.** A finding dropped in step 4 for lacking a quote was still a claim, and the eval's
hallucination metric should see it. A dimension the model never returned is not a claim.

**Dropped findings cannot reach step 6, by type.** Step 5 returns two arrays: `surviving`, whose
element type has no status field and a non-null evidence, and `dropped`. The report step is written
against `SurvivingFinding` only. The dropped list, the quote each rested on, and the per-finding
trail go to the owner view; the designer sees the one sentence of §14.8.

## 2026-09-07 · Step 6, Report: choose in code, write with the model

**H is ★ and eligible to be the weakest part; eligibility equals the ★ set (A–E, H).** Directed by
Shanica on 7 September: worked example 1 names H as Huddle's weakest part. The v0.2 contract copy
in this repo's history did not star H; `rubric/rubric.md` now does, with a note, pending the
updated contract. F, G, I, J stay ineligible along with K and L.

**The weakest part is chosen by a fixed rule in code, before any model writes a word.** In order:
a trust problem on H outranks any ordinary gap; then missing over weak over not-on-this-page; then
the plan's emphasis; then confidence. Only when all four tie does the model choose, and only among
the tied set, which the output schema itself restricts it to. Every ranking input, score and
exclusion reason is returned for the owner view. Reason: "prioritised" is the eval dimension
most tied to Shanica's sealed verdict; a rule that can be read and edited is one that can be
tuned against that verdict, and a model's silent ranking cannot.

**A trust problem is a flag the check step raises, only on H, only with a weak or missing verdict,
and only with the evidence quoted.** Code clears it anywhere else. The ranking reads the flag; it
does not try to detect fabrication itself.

**`not_on_this_page` ranks below `weak`.** A gap that may live behind a link the tool did not read
is a lower-confidence claim about this page than a gap the page itself shows.

**A strong case study gets no invented weakness.** When no ★ dimension is weak or missing among
the verified findings, the report names no weakest part, offers no fix, and the model is not
called. The eval's strong slice depends on this.

**The model only ever sees surviving findings.** `buildReport` takes `VerifyOk.surviving` by type.
The model writes the prose (plain-words name, why weak, why it outranks, the fix, what's missing
toward the target, secondary notes); code assembles inventory, could-not-judge, assumptions and
the verification sentence from data that already exists. Citations the model gives for the fix and
the target sentence are checked against surviving weak findings; a target sentence with no
surviving citation is replaced with the weakest finding's own level gap (§4.2, no generic advice).

**Report runs on the strong tier.** The contract's cost-routing row does not name the report
step. The fix and the framing are what the designer acts on, and the tone rules of §3 are the
hardest to hold, so it gets the strong model. One call, ~6k output tokens. Change the tier in
`src/steps/report.ts` if the eval shows the cheap tier holds.

## 2026-09-07 · Output layer, step 1: the landing view

**The UI reference (`case-check-ui-reference.html`) is the visual source of truth.** Its tokens,
type scale and structure are ported into `app/globals.css` as-is. Satoshi loads from Fontshare in
the root layout, weights 300/400/500 only. Gradients appear only on the aurora, the orb, the
primary button and the brand mark, as the reference draws them. 4px radius everywhere.

**Landing copy lives in `content/copy.ts` under `landing`.** The rubric list on the landing takes
its names and weighting from `rubric/dimensions.json` and its one-line explanations from copy, so
the star marks can never disagree with the data the engine uses.

**The two level selects wire straight into the pipeline.** Values map to the engine's levels;
`lead` is added as a level because the reference offers it as a target, so one step up from senior
is now lead. Nothing is preselected: the reference's preselected "Mid-level" was demo content.

**Owner mode is reachable only with `?owner` in the URL.** The reference shows the toggle in the
header; contract §14 says owner view is reached by a toggle or a query flag and is never the
default, and the brief says it is never shown to designers. Hiding the toggle itself behind the
flag satisfies both. Flip this by rendering the button unconditionally in `components/Header.tsx`.

**The photo slot is a gradient square until a photo is supplied.** Set `landing.brain.photoSrc` in
copy to a file under `public/` and the slot renders it.

**The running and report views are temporary raw panels** (`components/RawRun.tsx`) until steps 2
and 3 of the output layer replace them. They are styled under a `.raw` namespace so nothing from
the reference is touched when they go.
