import { Effect, Schema } from "effect";
import { readHttpJson, runHttpEffect } from "./effect-http";
import type { Locale } from "./i18n";
import type { source } from "./source";

export type SerializedDocsTree = Awaited<
  ReturnType<typeof source.serializePageTree>
>;

/** The build prerenders one navigation tree file per locale. */
export function docsTreeUrl(locale: Locale) {
  return `/api/docs-tree/${locale}`;
}

const serializedDocsTree = Schema.declare(
  (input): input is SerializedDocsTree =>
    typeof input === "object" &&
    input !== null &&
    "$fumadocs_loader" in input &&
    input.$fumadocs_loader === "page-tree" &&
    "data" in input &&
    typeof input.data === "object" &&
    input.data !== null,
);

// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is a class factory.
class DocsTreeLoadError extends Schema.TaggedError<
  DocsTreeLoadError,
  { readonly brand: unique symbol }
>()("DocsTreeLoadError", { status: Schema.Finite }) {}

/**
 * Read the prerendered tree with a deadline, so a stalled request cannot keep
 * a navigation pending. The signal cancels a superseded navigation's read.
 */
export function readDocsTree(locale: Locale, signal?: AbortSignal) {
  return runHttpEffect(
    readHttpJson(docsTreeUrl(locale), {}, serializedDocsTree).pipe(
      Effect.flatMap((response) =>
        response.ok
          ? Effect.succeed(response.data)
          : Effect.fail(DocsTreeLoadError.make({ status: response.status })),
      ),
    ),
    signal,
  );
}
