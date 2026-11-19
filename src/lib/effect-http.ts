import {
  messageFields,
  messageKeySchema,
  messageValuesSchema,
} from "./messages";
import { Context, Effect, Layer, Schema } from "effect";

/** The portable fetch call signature, without runtime-specific static helpers. */
export type HttpFetch = (
  ...args: Parameters<typeof fetch>
) => ReturnType<typeof fetch>;

export class HttpClient extends Context.Service<
  HttpClient,
  { readonly fetch: HttpFetch }
>()("skinsrestorer.net/lib/effect-http/HttpClient") {}

// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is a class factory.
export class HttpError extends Schema.TaggedError<
  HttpError,
  { readonly brand: unique symbol }
>()("HttpError", {
  reason: Schema.Literals(["transport", "response", "timeout"]),
  message: Schema.String,
  messageKey: Schema.optional(messageKeySchema),
  messageValues: Schema.optional(messageValuesSchema),
  cause: Schema.optional(Schema.Unknown),
}) {}

/** Own the complete response, including transports that resolve after cancellation. */
export const readHttpBytes = Effect.fn("Http.readBytes")(function* (
  url: string,
  init: RequestInit = {},
  options: { timeoutMs?: number; maxBytes?: number } = {},
) {
  const client = yield* HttpClient;
  return yield* Effect.acquireUseRelease(
    Effect.sync(() => ({
      controller: new AbortController(),
      response: undefined as Response | undefined,
      reader: undefined as ReadableStreamDefaultReader<Uint8Array> | undefined,
    })),
    (owner) =>
      Effect.gen(function* () {
        const response = yield* Effect.tryPromise({
          try: async () => {
            const fetched = await client.fetch(url, {
              ...init,
              signal: owner.controller.signal,
            });
            if (owner.controller.signal.aborted) {
              await fetched.body?.cancel().catch(() => {});
              owner.controller.signal.throwIfAborted();
            }
            owner.response = fetched;
            return fetched;
          },
          catch: (cause) =>
            HttpError.make({
              reason: "transport",
              ...messageFields("errors.serviceCouldNotReached"),
              cause,
            }),
        });
        const reader: ReadableStreamDefaultReader<Uint8Array> | undefined =
          response.body?.getReader();
        owner.reader = reader;
        let size = 0;
        const parts: Uint8Array[] = [];
        if (reader)
          while (true) {
            const part = yield* Effect.tryPromise({
              try: () => reader.read(),
              catch: (cause) =>
                HttpError.make({
                  reason: "transport",
                  ...messageFields("errors.serviceResponseCouldNotRead"),
                  cause,
                }),
            });
            if (part.done) break;
            size += part.value.byteLength;
            if (size > (options.maxBytes ?? 2 * 1024 * 1024))
              return yield* HttpError.make({
                reason: "response",
                ...messageFields("errors.serviceResponseExceedsSizeLimit"),
              });
            parts.push(part.value);
          }
        const bytes = new Uint8Array(size);
        parts.reduce((offset, part) => {
          bytes.set(part, offset);
          return offset + part.byteLength;
        }, 0);
        return {
          ok: response.ok,
          status: response.status,
          contentType: response.headers.get("content-type"),
          bytes,
        };
      }).pipe(
        Effect.timeoutOrElse({
          duration: options.timeoutMs ?? 10_000,
          orElse: () =>
            Effect.fail(
              HttpError.make({
                reason: "timeout",
                ...messageFields("errors.serviceRequestTimedOut"),
              }),
            ),
        }),
      ),
    (owner) =>
      Effect.gen(function* () {
        // Close pending body reads normally before anything can error the stream.
        let cancellation: Promise<void> | undefined;
        if (owner.reader) {
          cancellation = owner.reader.cancel().catch(() => {});
          owner.reader.releaseLock();
        } else cancellation = owner.response?.body?.cancel().catch(() => {});
        if (!cancellation) {
          // Without a response, only an abort stops the request.
          owner.controller.abort();
          return;
        }
        // A fetch wrapper can read its own clone of this response, and our
        // branch's cancellation then waits for that read. An abort would reject
        // the wrapper's read with our reason, which reaches error tracking as
        // an unhandled AbortError. Abort only when the clone holds the transport
        // open past the deadline, so cleanup cannot hang on an unread clone.
        const settled = cancellation;
        yield* Effect.promise(() => settled).pipe(
          Effect.timeoutOrElse({
            duration: options.timeoutMs ?? 10_000,
            orElse: () =>
              Effect.promise(() => {
                owner.controller.abort();
                return settled;
              }),
          }),
        );
      }),
  );
});

export function readHttpText(
  url: string,
  init: RequestInit = {},
  options: { timeoutMs?: number; maxBytes?: number } = {},
) {
  return readHttpBytes(url, init, options).pipe(
    Effect.map((response) => ({
      ok: response.ok,
      status: response.status,
      text: new TextDecoder().decode(response.bytes),
    })),
    Effect.withSpan("Http.readText"),
  );
}

export function readHttpJson<A>(
  url: string,
  init: RequestInit,
  schema: Schema.Decoder<A>,
  options?: { timeoutMs?: number; maxBytes?: number },
) {
  return Effect.gen(function* () {
    const response = yield* readHttpText(url, init, options);
    const value: unknown = yield* Schema.decodeEffect(
      Schema.fromJsonString(Schema.Unknown),
    )(response.text).pipe(
      Effect.mapError((cause) =>
        HttpError.make({
          reason: "response",
          ...messageFields("errors.serviceReturnedInvalidJson"),
          cause,
        }),
      ),
    );
    const data = yield* Schema.decodeUnknownEffect(schema)(value).pipe(
      Effect.mapError((cause) =>
        HttpError.make({
          reason: "response",
          ...messageFields("errors.serviceReturnedInvalidResponse"),
          cause,
        }),
      ),
    );
    return { ok: response.ok, status: response.status, data };
  });
}

export const httpClientLayer = Layer.succeed(HttpClient, {
  fetch: (input, init) => fetch(input, init),
});

/** Promise interop belongs to framework, browser, and command entry points. */
export async function runHttpEffect<A, E>(
  program: Effect.Effect<A, E, HttpClient>,
  signal?: AbortSignal,
): Promise<A> {
  try {
    return await Effect.runPromise(
      program.pipe(Effect.provide(httpClientLayer)),
      { signal },
    );
  } catch (cause) {
    signal?.throwIfAborted();
    throw cause;
  }
}
