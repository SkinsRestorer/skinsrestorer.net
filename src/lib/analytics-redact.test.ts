import assert from "node:assert/strict";
import { test } from "node:test";
import { redactEditorParams } from "./analytics-redact";

test("texture hashes and handoff ids are removed from nested event data", () => {
  const event = {
    event: "$pageview",
    properties: {
      $current_url: "https://skinsrestorer.net/editor?texture=abc123&x=1#top",
      nested: [{ href: "/upload?handoff=4f1e-22" }],
      count: 3,
    },
  };
  assert.deepEqual(redactEditorParams(event), {
    event: "$pageview",
    properties: {
      $current_url: "https://skinsrestorer.net/editor?texture=redacted&x=1#top",
      nested: [{ href: "/upload?handoff=redacted" }],
      count: 3,
    },
  });
  assert.equal(redactEditorParams("/docs?q=texture"), "/docs?q=texture");
});
