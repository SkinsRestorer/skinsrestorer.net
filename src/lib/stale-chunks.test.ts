import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldReloadForStaleChunk } from "./stale-chunks";

test("a stale chunk reloads the page once per minute at most", () => {
  const now = 1_000_000;
  assert.equal(shouldReloadForStaleChunk(null, now), true);
  assert.equal(shouldReloadForStaleChunk(String(now - 5_000), now), false);
  assert.equal(shouldReloadForStaleChunk(String(now - 60_000), now), true);
  assert.equal(shouldReloadForStaleChunk("not a time", now), true);
});
