/**
 * Exercises step 1 against a tiny local web server, because the build sandbox
 * cannot reach the public internet. Run `npm run fetch -- <real url>` on a
 * machine that can, to see it against a real portfolio.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fetchPage } from "../src/steps/fetch";

const fixture = readFileSync(fileURLToPath(new URL("./fixtures/framer-like.html", import.meta.url)));

let server: http.Server;
let base: string;

before(async () => {
  server = http.createServer((req, res) => {
    switch (req.url) {
      case "/case":
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return res.end(fixture);
      case "/file.pdf":
        res.writeHead(200, { "content-type": "application/pdf" });
        return res.end("%PDF-1.4 not really");
      default:
        res.writeHead(404, { "content-type": "text/html" });
        return res.end("<h1>Not found</h1>");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  base = `http://127.0.0.1:${port}`;
});

after(() => server.close());

test("returns cleaned, de-duplicated visible text plus raw page facts", async () => {
  const result = await fetchPage(`${base}/case`, { settleMs: 1000 });
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.status, 200);
  assert.equal(result.title, "Huddle — a case study");
  assert.equal(result.imageCount, 2);

  const lines = result.text.split("\n");
  // Hidden breakpoint copies and the visible duplicate are collapsed to one line each.
  assert.equal(lines.filter((l) => l.startsWith("A 7-week solo concept app")).length, 1);
  assert.equal(lines.filter((l) => l.startsWith("Research is claimed")).length, 1);
  assert.ok(lines.includes("Huddle"));
  assert.ok(result.wordCount > 10);
});

test("captures an animated stat counter at its initial value (known artefact, contract §8)", async () => {
  // We fetch well before the 5s animation completes, so the text says "0%".
  // This is deliberate documentation: a later step must not treat "0%" as a claim.
  const result = await fetchPage(`${base}/case`, { settleMs: 500 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.match(result.text, /grew by 0%/);
});

test("reports a 404 as http_error with the status", async () => {
  const result = await fetchPage(`${base}/missing`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "http_error");
  assert.equal(result.status, 404);
});

test("reports a PDF as not_html rather than pretending to read it", async () => {
  const result = await fetchPage(`${base}/file.pdf`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "not_html");
});

test("rejects non-http links before opening a browser", async () => {
  const result = await fetchPage("mailto:hello@example.com");
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "invalid_url");
});

test("reports a closed port as unreachable", async () => {
  const result = await fetchPage("http://127.0.0.1:9/", { timeoutMs: 5000 });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "unreachable");
});
