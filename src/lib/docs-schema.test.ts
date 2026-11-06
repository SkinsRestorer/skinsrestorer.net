import assert from "node:assert/strict";
import { test } from "node:test";
import { Schema } from "effect";
import { docsSchema, docsFrontmatterSchema } from "./docs-schema";

const metadata = {
  title: "Setup",
  icon: "Book",
  description: "Set up the plugin",
  docType: "how-to",
  appliesTo: "Servers",
  reviewed: "2026-11-06",
  version: "15.0.0",
};
const decode = Schema.decodeUnknownSync(docsSchema);

test("preserves page metadata and strips unsupported fields", () => {
  assert.deepEqual(
    decode({
      ...metadata,
      full: true,
      _openapi: { source: "test" },
      extra: true,
    }),
    { ...metadata, full: true, _openapi: { source: "test" } },
  );
});

test("rejects invalid editorial metadata", () => {
  for (const patch of [
    { icon: "" },
    { description: "" },
    { docType: "guide" },
    { reviewed: "2026-02-30" },
    { version: "15" },
  ])
    assert.throws(() => decode({ ...metadata, ...patch }));
});

test("exposes the same validation contract to Fumadocs", async () => {
  const result = await docsFrontmatterSchema["~standard"].validate(metadata);
  assert.equal(result.issues, undefined);
  assert.deepEqual(result.value, metadata);
});
