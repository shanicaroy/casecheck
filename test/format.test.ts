/**
 * URL handling for what a designer actually pastes. A schemeless link
 * ("behance.net/gallery/…") must still resolve to a real host so the
 * reader-block guard can catch it and the fetch step doesn't reject it as
 * invalid. No browser or model needed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeUrl, hostOf, displaySource } from "../src/ui/format";

test("normalizeUrl gives a schemeless link an https:// scheme", () => {
  assert.equal(normalizeUrl("behance.net/gallery/1/x"), "https://behance.net/gallery/1/x");
  assert.equal(normalizeUrl("www.behance.net/gallery/1"), "https://www.behance.net/gallery/1");
  assert.equal(normalizeUrl("  behance.net  "), "https://behance.net");
});

test("normalizeUrl leaves a link that already names its scheme untouched", () => {
  assert.equal(normalizeUrl("https://x.com/a"), "https://x.com/a");
  assert.equal(normalizeUrl("http://x.com"), "http://x.com");
});

test("normalizeUrl passes an empty string through", () => {
  assert.equal(normalizeUrl(""), "");
  assert.equal(normalizeUrl("   "), "");
});

test("hostOf resolves the host of a schemeless link and drops www", () => {
  assert.equal(hostOf("www.behance.net/gallery/1/x"), "behance.net");
  assert.equal(hostOf("behance.net/gallery/1"), "behance.net");
  assert.equal(hostOf("https://www.behance.net/gallery/1"), "behance.net");
});

test("hostOf returns null for something that is not a link at all", () => {
  assert.equal(hostOf(""), null);
});

test("displaySource strips the scheme a normalized link carries", () => {
  assert.equal(displaySource(normalizeUrl("behance.net/gallery/1")), "behance.net/gallery/1");
});
