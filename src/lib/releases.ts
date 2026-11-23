import { Clock, Effect, Schema } from "effect";
import { readHttpJson, runHttpEffect } from "./effect-http";
import { type SharedCache, workerCache } from "./worker-cache";

const RELEASE_TTL_SECONDS = 120;
// Workers share the Cache API across isolates in a data center. The key only
// has to belong to the site's zone; nothing serves this URL.
const SHARED_RELEASE_CACHE_KEY =
  "https://skinsrestorer.net/_cache/github/latest-release";

// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is a class factory.
class ReleaseCacheError extends Schema.TaggedError<
  ReleaseCacheError,
  { readonly brand: unique symbol }
>()("ReleaseCacheError", { cause: Schema.Unknown }) {}

const releaseSchema = Schema.Struct({
  html_url: Schema.String,
  tag_name: Schema.String,
});

export const latestReleaseEffect = readHttpJson(
  "https://api.github.com/repos/SkinsRestorer/SkinsRestorer/releases/latest",
  // GitHub rejects API requests without a User-Agent.
  {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "skinsrestorer.net",
    },
  },
  releaseSchema,
).pipe(
  Effect.map((response) => (response.ok ? response.data : null)),
  Effect.orElseSucceed(() => null),
);

// The shared entry records when GitHub answered, so an isolate can cap its own
// copy and a release is never much older than the TTL.
const sharedEntrySchema = Schema.Struct({
  release: releaseSchema,
  fetchedAt: Schema.Finite,
});

/**
 * Read the release through a cache that all isolates in a data center share.
 * A cache failure falls back to GitHub, and a failed GitHub read is not stored.
 * The result includes its age, so an in-memory copy can expire with the shared
 * entry.
 */
export const sharedLatestReleaseEffect = (cache: SharedCache | undefined) =>
  Effect.gen(function* () {
    if (!cache) return { release: yield* latestReleaseEffect, ageMs: 0 };
    const cached = yield* Effect.tryPromise({
      try: async () => (await cache.match(SHARED_RELEASE_CACHE_KEY))?.text(),
      catch: (cause) => ReleaseCacheError.make({ cause }),
    }).pipe(
      Effect.flatMap((text) =>
        text === undefined
          ? Effect.undefined
          : Schema.decodeEffect(Schema.fromJsonString(sharedEntrySchema))(text),
      ),
      Effect.orElseSucceed(() => undefined),
    );
    const now = yield* Clock.currentTimeMillis;
    if (cached)
      return {
        release: cached.release,
        ageMs: Math.max(0, now - cached.fetchedAt),
      };
    const release = yield* latestReleaseEffect;
    if (release)
      yield* Effect.tryPromise({
        try: () =>
          cache.put(
            SHARED_RELEASE_CACHE_KEY,
            Response.json(
              { release, fetchedAt: now },
              {
                headers: {
                  "Cache-Control": `public, max-age=${RELEASE_TTL_SECONDS}`,
                },
              },
            ),
          ),
        catch: (cause) => ReleaseCacheError.make({ cause }),
      }).pipe(Effect.ignore);
    return { release, ageMs: 0 };
  });

/**
 * Keep the release in memory until the shared entry it came from expires.
 * Concurrent reads share one request.
 */
export const cacheLatestRelease = (cache: () => SharedCache | undefined) =>
  Effect.runSync(
    Effect.cachedWithTTL(
      Effect.suspend(() => sharedLatestReleaseEffect(cache())),
      (exit) =>
        Math.max(
          0,
          RELEASE_TTL_SECONDS * 1000 -
            (exit._tag === "Success" ? exit.value.ageMs : 0),
        ),
    ),
  ).pipe(Effect.map(({ release }) => release));

const cachedLatestReleaseEffect = cacheLatestRelease(workerCache);

export const getLatestRelease = () => runHttpEffect(cachedLatestReleaseEffect);
