# Prompts

Every model prompt the agent uses, one file per step (classify, plan, run checks, self-verify, report).

Empty in slice one: the fetch step calls no model. Prompts live here, separate from `src/`, so the
wording can be changed without changing the app logic.
