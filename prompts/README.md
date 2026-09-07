# Prompts

Every model-facing prompt, one file per step. The app loads these at run time and sends them as the
system prompt; it never edits them. Change the wording here without touching `src/`.

- `classify.md` — step 2, Classify (cheap model). Describes what the page is.
- `plan.md` — step 3, Plan (cheap model). Decides how hard each rubric dimension is pressed, and
  on what question, for this case and this target level. The rubric text is appended to it.

The shape of the answer each prompt must produce (the JSON schema) lives next to the step's code in
`src/steps/`, because the code that reads the answer depends on it.
