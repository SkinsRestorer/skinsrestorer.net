import { Data, Effect } from "effect";
import type { InferPageType } from "fumadocs-core/source";
import { source } from "@/lib/source";

export class DocumentTextError extends Data.TaggedError("DocumentTextError")<{
  readonly url: string;
  readonly cause: unknown;
}> {}

export const getLLMTextEffect = Effect.fn("Docs.getText")(function* (
  page: InferPageType<typeof source>,
) {
  const processed = yield* Effect.tryPromise({
    try: () => page.data.getText("processed"),
    catch: (cause) => new DocumentTextError({ url: page.url, cause }),
  });
  return `# ${page.data.title}
URL: ${page.url}
SkinsRestorer: ${page.data.version}
Applies to: ${page.data.appliesTo}
Reviewed: ${page.data.reviewed}

${page.data.description}

${processed}`;
});

export const getFullLLMTextEffect = Effect.fn("Docs.getFullText")(function* () {
  const pages = yield* Effect.forEach(source.getPages("en"), getLLMTextEffect, {
    concurrency: 4,
  });
  return pages.join("\n\n");
});

export const getLLMText = (
  page: InferPageType<typeof source>,
  signal?: AbortSignal,
) => Effect.runPromise(getLLMTextEffect(page), { signal });
export const getFullLLMText = (signal?: AbortSignal) =>
  Effect.runPromise(getFullLLMTextEffect(), { signal });
