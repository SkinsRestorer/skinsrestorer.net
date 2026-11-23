import assert from "node:assert/strict";
import { test } from "node:test";
import { applyPatch, EditHistory, PatchBuilder } from "./skin-history";

const pixel = (pixels: Uint8ClampedArray, index: number) =>
  Array.from(pixels.subarray(index * 4, index * 4 + 4));

test("a patch keeps the value from before the first write and drops restored pixels", () => {
  const pixels = new Uint8ClampedArray(4 * 4);
  pixels.set([1, 2, 3, 4], 0);
  const builder = new PatchBuilder(pixels);
  assert.equal(builder.write(0, [1, 2, 3, 4]), false, "same value");
  assert.equal(builder.write(1, [9, 9, 9, 9]), true);
  builder.write(1, [8, 8, 8, 8]);
  builder.write(2, [5, 5, 5, 5]);
  builder.write(2, [0, 0, 0, 0]); // back to the old value
  const patch = builder.finish();
  assert.ok(patch);
  assert.deepEqual([...patch.indices], [1]);
  assert.deepEqual([...patch.before], [0, 0, 0, 0]);
  assert.deepEqual([...patch.after], [8, 8, 8, 8]);

  applyPatch(pixels, patch, "undo");
  assert.deepEqual(pixel(pixels, 1), [0, 0, 0, 0]);
  applyPatch(pixels, patch, "redo");
  assert.deepEqual(pixel(pixels, 1), [8, 8, 8, 8]);
});

test("a builder with no net change gives no patch", () => {
  const pixels = new Uint8ClampedArray(4);
  const builder = new PatchBuilder(pixels);
  builder.write(0, [1, 1, 1, 1]);
  builder.write(0, [0, 0, 0, 0]);
  assert.equal(builder.finish(), undefined);
});

const step = (n: number) => ({
  indices: Uint16Array.of(n),
  before: new Uint8ClampedArray(4),
  after: new Uint8ClampedArray(4),
});

test("history drops the oldest step past its limit and a new step clears redo", () => {
  const history = new EditHistory(2);
  for (const n of [1, 2, 3]) history.push(step(n));
  assert.equal(history.undo()?.indices[0], 3);
  assert.equal(history.undo()?.indices[0], 2);
  assert.equal(history.undo(), undefined, "step 1 was dropped");
  assert.equal(history.canRedo, true);
  assert.equal(history.redo()?.indices[0], 2);
  history.push(step(4));
  assert.equal(history.canRedo, false);
  assert.equal(history.redo(), undefined);
  history.clear();
  assert.equal(history.canUndo, false);
});
