import { Effect, Schema } from "effect";
import { readHttpText, runHttpEffect } from "@/lib/effect-http";

const cache = new Map<string, string>();

// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is a class factory.
class MarkdownLoadError extends Schema.TaggedError<
  MarkdownLoadError,
  { readonly brand: unique symbol }
>()("MarkdownLoadError", {
  url: Schema.String,
  cause: Schema.Unknown,
}) {}

/** The read has a deadline, so the copy button cannot stay busy. */
export async function loadMarkdown(url: string) {
  const cached = cache.get(url);
  if (cached !== undefined) return cached;
  const content = await runHttpEffect(
    readHttpText(url).pipe(
      Effect.flatMap((response) =>
        response.ok
          ? Effect.succeed(response.text)
          : Effect.fail(
              MarkdownLoadError.make({ url, cause: response.status }),
            ),
      ),
      Effect.mapError((cause) =>
        cause instanceof MarkdownLoadError
          ? cause
          : MarkdownLoadError.make({ url, cause }),
      ),
    ),
  );
  cache.set(url, content);
  return content;
}
