import assert from "node:assert/strict";
import { test } from "node:test";
import { LocationWrite, type Timer } from "./location-write";

/** A clock that moves only when the test advances it. */
function manualClock() {
  let now = 0;
  const timers = new Set<{ at: number; callback: () => void }>();
  const timer: Timer = (callback, ms) => {
    const entry = { at: now + ms, callback };
    timers.add(entry);
    return () => {
      timers.delete(entry);
    };
  };
  const advance = (ms: number) => {
    now += ms;
    for (const entry of [...timers].toSorted((a, b) => a.at - b.at)) {
      if (entry.at > now || !timers.has(entry)) continue;
      timers.delete(entry);
      entry.callback();
    }
  };
  return { timer, advance };
}

function setup() {
  const clock = manualClock();
  const location = { key: "a" };
  const writes: (string | undefined)[] = [];
  const write = new LocationWrite<string | undefined>(
    () => location.key,
    (value) => {
      writes.push(value);
    },
    20,
    clock.timer,
  );
  return { advance: clock.advance, location, writes, write };
}

test("typing writes the URL once, after the pause, with the latest text", () => {
  const { advance, writes, write } = setup();
  write.schedule("r");
  advance(15);
  write.schedule("re");
  advance(15);
  write.schedule("red");
  // Each keystroke restarts the pause.
  advance(19);
  assert.deepEqual(writes, []);
  advance(1);
  assert.deepEqual(writes, ["red"]);
  advance(100);
  assert.deepEqual(writes, ["red"]);
});

test("a waiting write is dropped when the history entry changes", () => {
  const { advance, location, writes, write } = setup();
  write.schedule("red");
  // Back, Forward, or a link moved to another entry before the pause ended.
  location.key = "b";
  advance(20);
  assert.deepEqual(writes, []);
  // Typing on the new entry writes to it.
  write.schedule("blue");
  advance(20);
  assert.deepEqual(writes, ["blue"]);
});

test("cancel drops the waiting write and flush writes it at once", () => {
  const { advance, writes, write } = setup();
  write.schedule("red");
  write.cancel();
  advance(20);
  assert.deepEqual(writes, []);
  write.schedule(undefined);
  write.flush();
  assert.deepEqual(writes, [undefined]);
  // The flushed write does not run again when its pause ends.
  advance(20);
  assert.deepEqual(writes, [undefined]);
});

test("flush does not write to an entry the user has left", () => {
  const { location, writes, write } = setup();
  write.schedule("red");
  location.key = "b";
  write.flush();
  assert.deepEqual(writes, []);
});
