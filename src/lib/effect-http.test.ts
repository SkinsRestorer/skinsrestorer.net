import assert from "node:assert/strict";
import { test } from "node:test";
import { Effect, Fiber, Result, Schema } from "effect";
import { TestClock } from "effect/testing";
import { HttpClient, readHttpJson, readHttpText } from "./effect-http";

const url = "https://service.example/result";
const provide = <A, E, R>(
  program: Effect.Effect<A, E, R | HttpClient>,
  fetcher: typeof fetch,
) => program.pipe(Effect.provideService(HttpClient, { fetch: fetcher }));

test("HTTP deadline aborts pending headers without waiting for the transport", async () => {
  let signal: AbortSignal | null | undefined;
  const transport: typeof fetch = (_url, init) => {
    signal = init?.signal;
    return new Promise(() => undefined);
  };
  const outcome = await Effect.runPromise(
    provide(
      Effect.gen(function* () {
        const pending = yield* Effect.forkChild(
          Effect.result(readHttpText(url)),
        );
        yield* TestClock.adjust(10_000);
        return yield* Fiber.join(pending);
      }),
      transport,
    ).pipe(Effect.provide(TestClock.layer())),
  );
  assert.equal(Result.isFailure(outcome) && outcome.failure.reason, "timeout");
  assert.equal(signal?.aborted, true);
});

test("body deadlines cancel and unlock a stalled response", async () => {
  let cancelled = 0;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode('{"id":'));
    },
    cancel() {
      cancelled++;
    },
  });
  const result = await Effect.runPromise(
    provide(
      Effect.gen(function* () {
        const pending = yield* Effect.forkChild(
          Effect.result(readHttpText(url)),
        );
        yield* TestClock.adjust(10_000);
        return yield* Fiber.join(pending);
      }),
      async () => new Response(body),
    ).pipe(Effect.provide(TestClock.layer())),
  );
  assert.equal(Result.isFailure(result) && result.failure.reason, "timeout");
  assert.equal(cancelled, 1);
  assert.equal(body.locked, false);
});

test("late responses from a cancelled transport are discarded", async () => {
  let finish!: (response: Response) => void;
  let started!: () => void;
  let closed!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const cancelled = new Promise<void>((resolve) => {
    closed = resolve;
  });
  const transport: typeof fetch = () => {
    started();
    return new Promise((resolve) => {
      finish = resolve;
    });
  };
  const controller = new AbortController();
  const pending = Effect.runPromiseExit(provide(readHttpText(url), transport), {
    signal: controller.signal,
  });
  await ready;
  controller.abort();
  await pending;
  finish(
    new Response(
      new ReadableStream({
        cancel() {
          closed();
        },
      }),
    ),
  );
  await cancelled;
});

test("oversized and invalid responses fail with typed errors and release readers", async () => {
  let cancelled = 0;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(5));
    },
    cancel() {
      cancelled++;
    },
  });
  await assert.rejects(
    Effect.runPromise(
      provide(
        readHttpText(url, {}, { maxBytes: 4 }),
        async () => new Response(body),
      ),
    ),
    {
      reason: "response",
      message: "The service response exceeds the size limit.",
    },
  );
  assert.equal(cancelled, 1);
  assert.equal(body.locked, false);
  await assert.rejects(
    Effect.runPromise(
      provide(
        readHttpJson(url, {}, Schema.Struct({ id: Schema.String })),
        async () => Response.json({ id: 1 }),
      ),
    ),
    {
      reason: "response",
      message: "The service returned an invalid response.",
    },
  );
});

test("HTTP cancellation waits for response reader cleanup", async () => {
  let start!: () => void;
  let cancelling!: () => void;
  let close!: () => void;
  const started = new Promise<void>((resolve) => {
    start = resolve;
  });
  const closing = new Promise<void>((resolve) => {
    cancelling = resolve;
  });
  const closed = new Promise<void>((resolve) => {
    close = resolve;
  });
  const body = new ReadableStream<Uint8Array>(
    {
      pull() {
        start();
      },
      cancel() {
        cancelling();
        return closed;
      },
    },
    { highWaterMark: 0 },
  );
  const controller = new AbortController();
  let settled = false;
  const pending = Effect.runPromiseExit(
    provide(readHttpText(url), async () => new Response(body)),
    { signal: controller.signal },
  ).then(() => {
    settled = true;
  });
  await started;
  controller.abort();
  await closing;
  assert.equal(settled, false);
  close();
  await pending;
  assert.equal(body.locked, false);
});
