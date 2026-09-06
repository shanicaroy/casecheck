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

## 2026-09-06 · Hosting (pending)

**Case Check will be its own Vercel project, "case-check-agent", on the uxpective.com domain.**
Not yet done: the build session has no Vercel access (no CLI, token or connector), so the project
and domain are created in the Vercel dashboard by Shanica. Open question to settle first: apex
`uxpective.com` currently serves the UXPective site, so Case Check most likely lives on a
subdomain (e.g. `casecheck.uxpective.com`) or a path. Whichever is chosen, the reason goes here.
Also note: as of slice one there is no web page to deploy; the pipeline runs from the terminal.
The page arrives in a later slice.
