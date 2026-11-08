import type { HttpFetch } from "./effect-http";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { HttpClient } from "./effect-http";
import { cachedLatestReleaseEffect, latestReleaseEffect } from "./releases";

test("release reads decode GitHub data and return a safe fallback", async () => {
  const run = (fetcher: HttpFetch) =>
    Effect.runPromise(
      latestReleaseEffect.pipe(
        Effect.provideService(HttpClient, { fetch: fetcher }),
      ),
    );
  const result = await run(async () => {
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

test("release reads share a result for 120 seconds before refreshing", async () => {
  let requests = 0;
  await Effect.runPromise(
    Effect.gen(function* () {
      const first = yield* cachedLatestReleaseEffect;
      const second = yield* cachedLatestReleaseEffect;
      assert.equal(first?.tag_name, "release-1");
      assert.deepEqual(second, first);
      assert.equal(requests, 1);
      yield* TestClock.adjust(119_999);
      yield* cachedLatestReleaseEffect;
      assert.equal(requests, 1);
      yield* TestClock.adjust(1);
      const refreshed = yield* cachedLatestReleaseEffect;
      assert.equal(refreshed?.tag_name, "release-2");
      assert.equal(requests, 2);
    }).pipe(
      Effect.provideService(HttpClient, {
        fetch: async () =>
          Response.json({
            html_url:
              "https://github.com/SkinsRestorer/SkinsRestorer/releases/latest",
            tag_name: `release-${++requests}`,
          }),
      }),
      Effect.provide(TestClock.layer()),
    ),
  );
});
