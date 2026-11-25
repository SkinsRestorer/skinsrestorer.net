import assert from "node:assert/strict";
import { test } from "node:test";
import { Effect } from "effect";
import { act, useEffect } from "react";
import { render, registerDom } from "@/test/dom";
import { abortable } from "../latest-effect";
import { useLatestEffect } from "./use-latest-effect";

registerDom();

function deferred<A>() {
  let resolve!: (value: A) => void;
  const promise = new Promise<A>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

let latest: ReturnType<typeof useLatestEffect> | undefined;
function Probe(props: {
  readonly onReady: (task: ReturnType<typeof useLatestEffect>) => void;
}) {
  const task = useLatestEffect();
  const { onReady } = props;
  useEffect(() => {
    onReady(task);
  }, [onReady, task]);
  return null;
}
const keep = (task: ReturnType<typeof useLatestEffect>) => {
  latest = task;
};

/** A job that reports its result, with the signal its request received. */
function request(observed: string[]) {
  const response = deferred<string>();
  let signal: AbortSignal | undefined;
  const job = abortable((received) => {
    signal = received;
    return response.promise;
  }).pipe(
    Effect.match({
      onSuccess: (value) => {
        observed.push(value);
      },
      onFailure: () => {
        observed.push("error");
      },
    }),
  );
  return { job, response, aborted: () => signal?.aborted };
}

const settle = () =>
  act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });

test("a newer request aborts the older one and only the newer one publishes", async () => {
  const view = render(<Probe onReady={keep} />);
  const observed: string[] = [];
  const older = request(observed);
  const newer = request(observed);
  act(() => {
    latest?.run(older.job);
  });
  act(() => {
    latest?.run(newer.job);
  });
  assert.equal(older.aborted(), true);

  older.response.resolve("older");
  await settle();
  assert.deepEqual(observed, []);
  newer.response.resolve("newer");
  await settle();
  assert.deepEqual(observed, ["newer"]);
  assert.equal(newer.aborted(), false);
  view.unmount();
});

test("cancel and unmount abort the running request", async () => {
  const view = render(<Probe onReady={keep} />);
  const observed: string[] = [];
  const cancelled = request(observed);
  act(() => {
    latest?.run(cancelled.job);
    latest?.cancel();
  });
  assert.equal(cancelled.aborted(), true);

  const unmounted = request(observed);
  act(() => {
    latest?.run(unmounted.job);
  });
  view.unmount();
  await settle();
  assert.equal(unmounted.aborted(), true);
  unmounted.response.resolve("late");
  await settle();
  assert.deepEqual(observed, []);
});
