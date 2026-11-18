import type { HttpFetch } from "./effect-http";
import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";
import { Effect, Fiber, Result, Schema } from "effect";
import { TestClock } from "effect/testing";
import { HttpClient, readHttpJson, readHttpText } from "./effect-http";

const url = "https://service.example/result";
const provide = <A, E, R>(
  program: Effect.Effect<A, E, R | HttpClient>,
  fetcher: HttpFetch,
) => program.pipe(Effect.provideService(HttpClient, { fetch: fetcher }));

test("HTTP deadline aborts pending headers without waiting for the transport", async () => {
  let signal: AbortSignal | null | undefined;
  const transport: HttpFetch = (_url, init) => {
    signal = init?.signal;
    return new Promise(() => {});
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
  const transport: HttpFetch = () => {
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
  ).finally(() => {
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

test("cancelling a response closes its reader without aborting the transport", async () => {
  const events: string[] = [];
  let transportSignal: AbortSignal | null | undefined;
  let reading!: () => void;
  const started = new Promise<void>((resolve) => {
    reading = resolve;
  });
  const transport: HttpFetch = async (_url, init) => {
    transportSignal = init?.signal;
    const body = new ReadableStream<Uint8Array>(
      {
        pull() {
          reading();
        },
        cancel() {
          events.push("cancel");
        },
      },
      { highWaterMark: 0 },
    );
    return new Response(body);
  };
  const caller = new AbortController();
  const pending = Effect.runPromiseExit(provide(readHttpText(url), transport), {
    signal: caller.signal,
  });
  await started;
  caller.abort();
  await pending;
  assert.deepEqual(events, ["cancel"]);
  assert.equal(transportSignal?.aborted, false);
});

test("cancellation lets a fetch wrapper finish reading its cloned body", async () => {
  let transportSignal: AbortSignal | null | undefined;
  let wrapperRead: Promise<string> | undefined;
  let reading!: () => void;
  let release!: () => void;
  const started = new Promise<void>((resolve) => {
    reading = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const transport: HttpFetch = async (_url, init) => {
    transportSignal = init?.signal;
    const body = new ReadableStream<Uint8Array>(
      {
        async pull(controller) {
          reading();
          await gate;
          controller.enqueue(new TextEncoder().encode("skin"));
          controller.close();
        },
      },
      { highWaterMark: 0 },
    );
    // Wrappers such as analytics or extensions read a clone of the response.
    const [appBody, wrapperBody] = body.tee();
    wrapperRead = new Response(wrapperBody).text();
    return new Response(appBody);
  };
  const caller = new AbortController();
  const pending = Effect.runPromiseExit(provide(readHttpText(url), transport), {
    signal: caller.signal,
  });
  await started;
  caller.abort();
  await yieldToEventLoop();
  release();
  await pending;
  assert.equal(await wrapperRead, "skin");
  assert.equal(transportSignal?.aborted, false);
});

test("an unread cloned body is aborted only after the deadline", async () => {
  let transportSignal: AbortSignal | null | undefined;
  let wrapperBody: ReadableStream<Uint8Array> | undefined;
  let reading!: () => void;
  const started = new Promise<void>((resolve) => {
    reading = resolve;
  });
  const transport: HttpFetch = async (_url, init) => {
    transportSignal = init?.signal;
    const body = new ReadableStream<Uint8Array>(
      {
        start(controller) {
          init?.signal?.addEventListener(
            "abort",
            () => controller.error(init.signal?.reason),
            { once: true },
          );
        },
        pull() {
          reading();
        },
      },
      { highWaterMark: 0 },
    );
    // A wrapper can keep its branch without ever reading it.
    let appBody: ReadableStream<Uint8Array>;
    [appBody, wrapperBody] = body.tee();
    return new Response(appBody);
  };
  try {
    await Effect.runPromise(
      provide(
        Effect.gen(function* () {
          const read = yield* Effect.forkChild(readHttpText(url));
          yield* Effect.promise(() => started);
          const stopping = yield* Effect.forkChild(Fiber.interrupt(read));
          yield* TestClock.adjust(9_999);
          assert.equal(transportSignal?.aborted, false);
          yield* TestClock.adjust(1);
          yield* Fiber.join(stopping);
        }),
        transport,
      ).pipe(Effect.provide(TestClock.layer())),
    );
    assert.equal(transportSignal?.aborted, true);
  } finally {
    await wrapperBody?.cancel().catch(() => undefined);
  }
});
