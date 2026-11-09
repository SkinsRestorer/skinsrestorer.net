import assert from "node:assert/strict";
import { test } from "node:test";
import { LocationWrite } from "./location-write";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function setup() {
  const location = { key: "a" };
  const writes: (string | undefined)[] = [];
  const write = new LocationWrite<string | undefined>(
    () => location.key,
    (value) => writes.push(value),
    20,
  );
  return { location, writes, write };
}

test("typing writes the URL once, after the pause, with the latest text", async () => {
  const { writes, write } = setup();
  write.schedule("r");
  write.schedule("re");
  write.schedule("red");
  await sleep(5);
  assert.deepEqual(writes, []);
  await sleep(40);
  assert.deepEqual(writes, ["red"]);
});

test("a waiting write is dropped when the history entry changes", async () => {
  const { location, writes, write } = setup();
  write.schedule("red");
  // Back, Forward, or a link moved to another entry before the pause ended.
  location.key = "b";
  await sleep(40);
  assert.deepEqual(writes, []);
  // Typing on the new entry writes to it.
  write.schedule("blue");
  await sleep(40);
  assert.deepEqual(writes, ["blue"]);
});

test("cancel drops the waiting write and flush writes it at once", async () => {
  const { writes, write } = setup();
  write.schedule("red");
  write.cancel();
  await sleep(40);
  assert.deepEqual(writes, []);
  write.schedule(undefined);
  write.flush();
  assert.deepEqual(writes, [undefined]);
});
