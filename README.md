# Case Check

A portfolio review agent that finds the single weakest part of a UX case study's narrative and
says how to fix it. The product contract and evaluation sheet are the source of truth for what it
does and does not do.

## Layout

```
app/            the web page (Next.js): one page plus API routes, no review logic
config/         which Claude model runs the cheap and strong tiers
content/        every word shown on the page, editable without touching components
src/steps/      the six agent steps, one file each (so far: fetch, classify)
src/pipeline/   runs the steps in order and streams one event per step
src/lib/        small helpers with no product logic (text clean-up, browser launch, model call, prompt loading)
src/cli/        run the pipeline or a step by hand from the terminal
rubric/         the UXPective storytelling framework as data, editable without touching code
prompts/        every model prompt, one per step, editable without touching code
docs/           decision log
test/           tests, with local HTML fixtures so no internet is needed
```

## Run it

```
npm install
npx playwright install chromium   # once, downloads the headless browser for local use
npm run dev                       # the page, at http://localhost:3000
npm run fetch -- https://someone.framer.website/case-study-01   # step 1 only
npm run check -- https://someone.framer.website/case-study-01   # the pipeline, needs ANTHROPIC_API_KEY in .env.local
npm test
```

Both the page and `npm run fetch` show exactly what step 1 hands to step 2: the page title, its
visible text with duplicate lines removed, and raw facts (status, word count, image count), or a
failure reason.

## Hosting

Deployed on Vercel at casecheck.uxpective.com. The project's Framework Preset must be **Next.js**.
`ANTHROPIC_API_KEY` must be set in the project's Environment Variables. On Vercel the fetch step uses the slim Chromium bundled by
`@sparticuz/chromium`; locally it uses Playwright's own download. See `src/lib/browser.ts`.
