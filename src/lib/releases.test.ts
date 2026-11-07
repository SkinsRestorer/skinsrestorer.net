import assert from "node:assert/strict";
import { test } from "node:test";
import { Effect } from "effect";
import { HttpClient } from "./effect-http";
import { latestReleaseEffect } from "./releases";

test("release reads preserve Next revalidation and return a safe fallback", async () => {
  const run = (fetcher: typeof fetch) =>
    Effect.runPromise(
      latestReleaseEffect.pipe(
        Effect.provideService(HttpClient, { fetch: fetcher }),
      ),
    );
  const result = await run(async (_url, init) => {
    assert.deepEqual(init?.next, { revalidate: 120 });
    return Response.json({
      html_url:
        "https://github.com/SkinsRestorer/SkinsRestorer/releases/tag/15.12.6",
      tag_name: "15.12.6",
    });
  });
  assert.equal(result?.tag_name, "15.12.6");
  assert.equal(
    await run(async () =>
      Response.json({ message: "Unavailable" }, { status: 503 }),
    ),
    null,
  );
  assert.equal(
    await run(async () => {
      throw new Error("offline");
    }),
    null,
  );
});
