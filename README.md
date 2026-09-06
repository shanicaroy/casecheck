# Case Check

A portfolio review agent that finds the single weakest part of a UX case study's narrative and
says how to fix it. The product contract and evaluation sheet are the source of truth for what it
does and does not do.

## Layout

```
src/steps/      the six agent steps, one file each (slice one: fetch only)
src/lib/        small helpers with no product logic (text clean-up)
src/cli/        run a step by hand from the terminal
rubric/         the UXPective storytelling framework as data, editable without touching code
prompts/        every model prompt, one per step, editable without touching code
docs/           decision log
test/           tests, with local HTML fixtures so no internet is needed
```

## Run it

```
npm install
npx playwright install chromium   # once, downloads the headless browser
npm run fetch -- https://someone.framer.website/case-study-01
npm test
```

`npm run fetch` prints exactly what step 1 hands to step 2: the page title, its visible text with
duplicate lines removed, and raw facts (status, word count, image count), or a failure reason.
