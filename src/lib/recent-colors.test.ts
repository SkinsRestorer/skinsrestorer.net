import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addRecentColor,
  readRecentColors,
  RECENT_COLORS_KEY,
  writeRecentColors,
} from "./recent-colors";
import type { KeyValueStorage } from "./skin-draft";
import type { Rgba } from "./skin-paint";

function memory(initial?: string): KeyValueStorage & { value?: string } {
  const store: KeyValueStorage & { value?: string } = {
    value: initial,
    getItem: (key) =>
      key === RECENT_COLORS_KEY ? (store.value ?? null) : null,
    setItem: (_key, value) => {
      store.value = value;
    },
    removeItem: () => {
      store.value = undefined;
    },
  };
  return store;
}

const colors = (count: number) =>
  Array.from({ length: count }, (_, i): Rgba => [i, 2 * i, 3 * i, 255 - i]);

test("recent colors keep order, alpha, and no duplicates, up to eight", () => {
  let list: Rgba[] = [];
  for (const color of colors(10)) list = addRecentColor(list, color);
  assert.equal(list.length, 8);
  assert.deepEqual(list[0], [9, 18, 27, 246]);
  list = addRecentColor(list, [5, 10, 15, 250]);
  assert.deepEqual(list[0], [5, 10, 15, 250]);
  assert.equal(list.length, 8);
  assert.equal(list.filter((c) => c[0] === 5).length, 1);
  // The same RGB at another opacity is another color.
  list = addRecentColor(list, [5, 10, 15, 100]);
  assert.deepEqual(list.slice(0, 2), [
    [5, 10, 15, 100],
    [5, 10, 15, 250],
  ]);
});

test("stored colors survive a reload and are validated", () => {
  const storage = memory();
  assert.deepEqual(readRecentColors(storage), { status: "none" });
  assert.equal(writeRecentColors(storage, colors(3)), true);
  assert.deepEqual(readRecentColors(storage), {
    status: "found",
    colors: colors(3),
  });
  for (const bad of [
    "{",
    "null",
    "[]",
    JSON.stringify({ version: 1, colors: [[1, 2, 3]] }),
    JSON.stringify({ version: 1, colors: [[1, 2, 3, 256]] }),
    JSON.stringify({ version: 1, colors: [[1, 2, 3, 1.5]] }),
    JSON.stringify({ colors: [[1, 2, 3, 4]] }),
  ])
    assert.deepEqual(readRecentColors(memory(bad)), { status: "corrupt" }, bad);
  assert.deepEqual(
    readRecentColors(memory(JSON.stringify({ version: 2, colors: "new" }))),
    { status: "newer" },
  );
  // Too many entries or duplicates from an edited value are trimmed.
  const edited = memory(
    JSON.stringify({
      version: 1,
      colors: [...colors(10), [0, 0, 0, 255]],
    }),
  );
  const read = readRecentColors(edited);
  assert.equal(read.status, "found");
  if (read.status === "found") {
    assert.equal(read.colors.length, 8);
    assert.deepEqual(read.colors, colors(8));
  }
});

test("blocked or full storage fails quietly", () => {
  const throwing: KeyValueStorage = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {},
  };
  assert.deepEqual(readRecentColors(throwing), { status: "unavailable" });
  assert.deepEqual(readRecentColors(undefined), { status: "unavailable" });
  assert.equal(writeRecentColors(throwing, colors(1)), false);
  assert.equal(writeRecentColors(undefined, colors(1)), false);
});
