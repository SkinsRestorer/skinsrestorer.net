import { Context, Data, Effect, Layer, Schema } from "effect";

export class HttpClient extends Context.Service<
  HttpClient,
  { readonly fetch: typeof fetch }
>()("skinsrestorer/HttpClient") {}

export class HttpError extends Data.TaggedError("HttpError")<{
  readonly reason: "transport" | "response" | "timeout";
  readonly message: string;
  readonly cause?: unknown;
}> {}

/** Own the complete response, including transports that resolve after cancellation. */
export const readHttpText = Effect.fn("Http.readText")(function* (
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
            const response = await client.fetch(url, {
              ...init,
              signal: owner.controller.signal,
            });
            if (owner.controller.signal.aborted) {
              await response.body?.cancel().catch(() => undefined);
              owner.controller.signal.throwIfAborted();
            }
            owner.response = response;
            return response;
          },
          catch: (cause) =>
            new HttpError({
              reason: "transport",
              message: "The service could not be reached.",
              cause,
            }),
        });
        owner.reader = response.body?.getReader();
        let size = 0;
        let text = "";
        const decoder = new TextDecoder();
        if (owner.reader)
          while (true) {
            const part = yield* Effect.tryPromise({
              try: () => owner.reader!.read(),
              catch: (cause) =>
                new HttpError({
                  reason: "transport",
                  message: "The service response could not be read.",
                  cause,
                }),
            });
            if (part.done) break;
            size += part.value.byteLength;
            if (size > (options.maxBytes ?? 2 * 1024 * 1024))
              return yield* new HttpError({
                reason: "response",
                message: "The service response exceeds the size limit.",
              });
            text += decoder.decode(part.value, { stream: true });
          }
        return {
          ok: response.ok,
          status: response.status,
          text: text + decoder.decode(),
        };
      }).pipe(
        Effect.timeoutOrElse({
          duration: options.timeoutMs ?? 10_000,
          orElse: () =>
            Effect.fail(
              new HttpError({
                reason: "timeout",
                message: "The service request timed out.",
              }),
            ),
        }),
      ),
    (owner) =>
      Effect.promise(async () => {
        owner.controller.abort();
        if (owner.reader) {
          await owner.reader.cancel().catch(() => undefined);
          owner.reader.releaseLock();
        } else await owner.response?.body?.cancel().catch(() => undefined);
      }),
  );
});

export function readHttpJson<A>(
  url: string,
  init: RequestInit,
  schema: Schema.Decoder<A>,
  options?: { timeoutMs?: number; maxBytes?: number },
) {
  return Effect.gen(function* () {
    const response = yield* readHttpText(url, init, options);
    const value: unknown = yield* Effect.try({
      try: () => JSON.parse(response.text),
      catch: (cause) =>
        new HttpError({
          reason: "response",
          message: "The service returned invalid JSON.",
          cause,
        }),
    });
    const data = yield* Schema.decodeUnknownEffect(schema)(value).pipe(
      Effect.mapError(
        (cause) =>
          new HttpError({
            reason: "response",
            message: "The service returned an invalid response.",
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
