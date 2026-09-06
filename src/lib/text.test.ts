import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanText, wordCount } from "./text.js";

test("cleanText collapses whitespace and drops empty lines", () => {
  const out = cleanText("  Hello   world \n\n\n  second   line  \n");
  assert.equal(out, "Hello world\nsecond line");
});

test("cleanText keeps only the first copy of a repeated line (Framer breakpoint duplicates)", () => {
  const para = "We redesigned the onboarding flow after five interviews.";
  const out = cleanText([para, "Other", para, para].join("\n"));
  assert.equal(out, `${para}\nOther`);
});

test("wordCount counts whitespace-separated words", () => {
  assert.equal(wordCount("one two\nthree"), 3);
  assert.equal(wordCount(""), 0);
});
