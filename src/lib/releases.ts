import { Effect, Schema } from "effect";
import { readHttpJson, runHttpEffect } from "./effect-http";

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

export const cachedLatestReleaseEffect = Effect.runSync(
  Effect.cachedWithTTL(latestReleaseEffect, "120 seconds"),
);

export const getLatestRelease = (signal?: AbortSignal) =>
  runHttpEffect(cachedLatestReleaseEffect, signal);
