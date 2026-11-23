import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isCspReportContentType,
  readBoundedText,
  sanitizeCspReport,
} from "./csp-report";

const hash = "a3f6c2b1d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d";

test("report-uri reports lose queries, fragments, and script samples", () => {
  const body = JSON.stringify({
    "csp-report": {
      "document-uri": `https://skinsrestorer.net/studio?texture=${hash}#top`,
      referrer: "https://skinsrestorer.net/upload?handoff=4f1e-22",
      "blocked-uri": "https://evil.example/x.js?id=1",
      "violated-directive": "script-src-elem",
      "source-file": "https://skinsrestorer.net/_build/a.js?v=2",
      "script-sample": `load("${hash}")`,
      "line-number": 4,
      "blocked-uri-keyword": "inline",
    },
  });
  assert.deepEqual(JSON.parse(sanitizeCspReport(body) ?? ""), {
    "csp-report": {
      "document-uri": "https://skinsrestorer.net/studio",
      referrer: "https://skinsrestorer.net/upload",
      "blocked-uri": "https://evil.example/x.js",
      "violated-directive": "script-src-elem",
      "source-file": "https://skinsrestorer.net/_build/a.js",
      "line-number": 4,
      "blocked-uri-keyword": "inline",
    },
  });
});

test("Reporting API batches are sanitized per report", () => {
  const body = JSON.stringify([
    {
      type: "csp-violation",
      url: `https://skinsrestorer.net/generator?texture=${hash}`,
      user_agent: "Mozilla/5.0",
      body: {
        documentURL: `https://skinsrestorer.net/generator?texture=${hash}`,
        blockedURL: "inline",
        sample: "alert(1)",
      },
    },
  ]);
  assert.deepEqual(JSON.parse(sanitizeCspReport(body) ?? ""), [
    {
      type: "csp-violation",
      url: "https://skinsrestorer.net/generator",
      user_agent: "Mozilla/5.0",
      body: {
        documentURL: "https://skinsrestorer.net/generator",
        blockedURL: "inline",
      },
    },
  ]);
});

test("bodies that are not JSON reports are rejected", () => {
  assert.equal(sanitizeCspReport("not json"), undefined);
  assert.equal(sanitizeCspReport('"text"'), undefined);
  assert.equal(sanitizeCspReport("null"), undefined);
});

test("only the two CSP report content types are accepted", () => {
  assert.ok(isCspReportContentType("application/csp-report"));
  assert.ok(isCspReportContentType("application/reports+json; charset=utf-8"));
  assert.ok(!isCspReportContentType("application/json"));
  assert.ok(!isCspReportContentType(null));
});

test("JSON that is not a CSP violation report is not forwarded", () => {
  assert.equal(sanitizeCspReport('{"event":"$pageview"}'), undefined);
  assert.equal(sanitizeCspReport('{"csp-report":"text"}'), undefined);
  assert.equal(sanitizeCspReport("[]"), undefined);
  assert.equal(
    sanitizeCspReport('[{"type":"deprecation","body":{"id":"x"}}]'),
    undefined,
  );
  // Other top-level fields and other report types are dropped.
  assert.deepEqual(
    JSON.parse(
      sanitizeCspReport(
        JSON.stringify({ "csp-report": { "line-number": 1 }, extra: "x" }),
      ) ?? "",
    ),
    { "csp-report": { "line-number": 1 } },
  );
  assert.deepEqual(
    JSON.parse(
      sanitizeCspReport(
        JSON.stringify([
          { type: "csp-violation", body: { blockedURL: "eval" } },
          { type: "intervention", body: {} },
        ]),
      ) ?? "",
    ),
    [{ type: "csp-violation", body: { blockedURL: "eval" } }],
  );
});

function chunks(...parts: string[]) {
  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const part = parts.shift();
      if (part === undefined) controller.close();
      else controller.enqueue(encoder.encode(part));
    },
    cancel() {
      cancelled = true;
    },
  });
  return { stream, cancelled: () => cancelled };
}

test("bodies are read up to the byte limit", async () => {
  // "é" takes two bytes, so this body is exactly 5 bytes long.
  const small = chunks("ab", "c\u00E9");
  assert.equal(await readBoundedText(small.stream, 5), "abc\u00E9");
  // A chunked body without Content-Length stops at the limit.
  const large = chunks("abc", "def", "never read");
  assert.equal(await readBoundedText(large.stream, 5), undefined);
  assert.ok(large.cancelled());
  assert.equal(await readBoundedText(null, 5), "");
});
