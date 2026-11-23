import type { HttpFetch } from "./effect-http";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { HttpClient } from "./effect-http";
import {
  cachedLatestReleaseEffect,
  latestReleaseEffect,
  sharedLatestReleaseEffect,
} from "./releases";
import { required } from "./utils";
import type { SharedCache } from "./worker-cache";

const run = (fetcher: HttpFetch) =>
  Effect.runPromise(
    latestReleaseEffect.pipe(
      Effect.provideService(HttpClient, { fetch: fetcher }),
    ),
  );

test("release reads decode GitHub data and return a safe fallback", async () => {
  const result = await run(() =>
    Promise.resolve(
      Response.json({
        html_url:
          "https://github.com/SkinsRestorer/SkinsRestorer/releases/tag/15.12.6",
        tag_name: "15.12.6",
      }),
    ),
  );
  assert.equal(result?.tag_name, "15.12.6");
  assert.equal(
    await run(() =>
      Promise.resolve(
        Response.json({ message: "Unavailable" }, { status: 503 }),
      ),
    ),
    null,
  );
  assert.equal(await run(() => Promise.reject(new Error("offline"))), null);
});

test("release reads identify the site to the GitHub API", async () => {
  const requests: Headers[] = [];
  await run((_url, init) => {
    requests.push(new Headers(init?.headers));
    return Promise.resolve(Response.json({}, { status: 403 }));
  });
  const headers = required(requests[0], "release request");
  assert.equal(headers.get("User-Agent"), "skinsrestorer.net");
  assert.equal(headers.get("Accept"), "application/vnd.github+json");
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
        fetch: () =>
          Promise.resolve(
            Response.json({
              html_url:
                "https://github.com/SkinsRestorer/SkinsRestorer/releases/latest",
              tag_name: `release-${++requests}`,
            }),
          ),
      }),
      Effect.provide(TestClock.layer()),
    ),
  );
});

test("release reads share GitHub results through the Workers cache", async () => {
  const stored = new Map<string, Response>();
  const cache: SharedCache = {
    match: (key) => Promise.resolve(stored.get(key)?.clone()),
    put: (key, response) => {
      stored.set(key, response);
      return Promise.resolve();
    },
  };
  const responses = [
    Response.json({ message: "Unavailable" }, { status: 503 }),
    Response.json({ html_url: "https://example.test", tag_name: "1.0.0" }),
  ];
  let requests = 0;
  const read = () =>
    Effect.runPromise(
      sharedLatestReleaseEffect(cache).pipe(
        Effect.provideService(HttpClient, {
          fetch: () => {
            requests++;
            return Promise.resolve(required(responses.shift(), "response"));
          },
        }),
      ),
    );
  // A failed read is not stored, so the next isolate asks GitHub again.
  assert.equal(await read(), null);
  assert.equal(stored.size, 0);
  assert.equal((await read())?.tag_name, "1.0.0");
  assert.equal(
    required(stored.values().next().value, "stored").headers.get(
      "Cache-Control",
    ),
    "public, max-age=120",
  );
  assert.equal((await read())?.tag_name, "1.0.0");
  assert.equal(requests, 2);
});

test("release reads fall back to GitHub when the Workers cache fails", async () => {
  const caches: SharedCache[] = [
    {
      match: () => Promise.reject(new Error("cache offline")),
      put: () => Promise.reject(new Error("cache offline")),
    },
    {
      // A corrupt entry must not reach the page.
      match: () => Promise.resolve(new Response("{")),
      put: () => Promise.resolve(),
    },
  ];
  for (const cache of caches) {
    let requests = 0;
    const release = await Effect.runPromise(
      sharedLatestReleaseEffect(cache).pipe(
        Effect.provideService(HttpClient, {
          fetch: () => {
            requests++;
            return Promise.resolve(
              Response.json({
                html_url: "https://example.test",
                tag_name: "2.0.0",
              }),
            );
          },
        }),
      ),
    );
    assert.equal(release?.tag_name, "2.0.0");
    assert.equal(requests, 1);
  }
});
