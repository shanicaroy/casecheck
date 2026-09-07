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
