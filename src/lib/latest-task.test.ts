import assert from "node:assert/strict";
import { test } from "node:test";
import { LatestTask } from "./latest-task";

function deferred<A>() {
  let resolve!: (value: A) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<A>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test("a superseded credential verification cannot publish or clear the new request", async () => {
  const task = new LatestTask();
  const previous = deferred<string>();
  const next = deferred<string>();
  const observed: string[] = [];
  let oldSignal: AbortSignal | undefined;
  const old = task.run(
    (signal) => {
      oldSignal = signal;
      return previous.promise;
    },
    (v) => observed.push(v),
    () => observed.push("old error"),
  );
  const current = task.run(
    () => next.promise,
    (v) => observed.push(v),
    () => observed.push("new error"),
  );
  previous.resolve("old credentials");
  await old;
  assert.equal(oldSignal?.aborted, true);
  assert.deepEqual(observed, []);
  next.resolve("new credentials");
  await current;
  assert.deepEqual(observed, ["new credentials"]);
});

test("unmount cancellation suppresses late successes and failures", async () => {
  for (const fail of [false, true]) {
    const task = new LatestTask();
    const result = deferred<string>();
    let published = false;
    const request = task.run(
      () => result.promise,
      () => {
        published = true;
      },
      () => {
        published = true;
      },
    );
    task.cancel();
    if (fail) result.reject(new Error("late error"));
    else result.resolve("late value");
    await request;
    assert.equal(published, false);
  }
});
