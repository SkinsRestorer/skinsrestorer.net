import assert from "node:assert/strict";
import { test } from "node:test";
import { createTemplate, pixelOffset } from "./skin-document";
import { SkinEditorStore } from "./skin-editor-store";
import { HISTORY_LIMIT } from "./skin-history";
import { allPartsVisible, type PaintSettings } from "./skin-paint";

const red = [200, 10, 10, 120] as const;

function setup(variant: "classic" | "slim" = "classic") {
  const store = new SkinEditorStore();
  store.load(createTemplate(variant));
  return store;
}

function settings(overrides: Partial<PaintSettings> = {}): PaintSettings {
  return {
    layer: "base",
    color: red,
    visibility: allPartsVisible(),
    ...overrides,
  };
}

const pixel = (store: SkinEditorStore, x: number, y: number) =>
  Array.from(store.pixels.subarray(pixelOffset(x, y), pixelOffset(x, y) + 4));

test("a fast stroke paints every pixel between samples and is one undo step", () => {
  const store = setup();
  const before = store.pixels.slice();
  store.beginStroke("pencil", settings(), 8, 8);
  store.strokeTo(15, 15); // one jump across the head front
  store.strokeTo(15, 8);
  store.endStroke();
  for (let i = 0; i < 8; i++) {
    assert.deepEqual(pixel(store, 8 + i, 8 + i), [200, 10, 10, 255]);
    assert.deepEqual(pixel(store, 15, 8 + i), [200, 10, 10, 255]);
  }
  assert.equal(store.getSnapshot().canUndo, true);
  assert.equal(store.undo(), true);
  assert.deepEqual(store.pixels, before);
  assert.equal(store.getSnapshot().canUndo, false);
  store.redo();
  assert.deepEqual(pixel(store, 12, 12), [200, 10, 10, 255]);
});

test("base strokes are opaque; outer strokes keep alpha; the eraser only clears the outer layer", () => {
  const store = setup();
  store.beginStroke("pencil", settings({ layer: "outer" }), 40, 8);
  store.endStroke();
  assert.deepEqual(pixel(store, 40, 8), [...red]);
  assert.equal(store.beginStroke("eraser", settings(), 10, 10), false);
  assert.equal(pixel(store, 10, 10)[3], 255);
  store.beginStroke("eraser", settings({ layer: "outer" }), 40, 8);
  store.endStroke();
  assert.deepEqual(pixel(store, 40, 8), [0, 0, 0, 0]);
});

test("strokes stay on the active layer, visible parts, and used pixels", () => {
  const store = setup();
  const before = store.pixels.slice();
  // An outer layer pixel while painting base, then an unused corner.
  store.beginStroke("pencil", settings(), 40, 10);
  store.endStroke();
  store.beginStroke("pencil", settings(), 0, 0);
  store.strokeTo(1, 1);
  store.endStroke();
  const hidden = allPartsVisible();
  hidden.head.base = false;
  store.beginStroke("pencil", settings({ visibility: hidden }), 10, 10);
  store.endStroke();
  assert.deepEqual(store.pixels, before);
  assert.equal(store.getSnapshot().canUndo, false);
  // A line that crosses an unused area paints only the used pixels on it.
  store.beginStroke("pencil", settings(), 0, 15);
  store.strokeTo(0, 0);
  store.endStroke();
  assert.deepEqual(pixel(store, 0, 8), [200, 10, 10, 255]);
  assert.equal(pixel(store, 0, 7)[3], 0);
});

test("surface lock keeps a 3D stroke on the face where it started", () => {
  const store = setup();
  store.beginStroke("pencil", settings(), 9, 9, { surfaceLock: true });
  store.strokeTo(20, 9); // head left side: skipped
  store.strokeTo(12, 9);
  store.endStroke();
  assert.deepEqual(pixel(store, 12, 9), [200, 10, 10, 255]);
  assert.notDeepEqual(pixel(store, 20, 9), [200, 10, 10, 255]);
  // The line resumes from the last pixel on the locked face.
  assert.deepEqual(pixel(store, 10, 9), [200, 10, 10, 255]);
});

test("fill replaces the connected color and stops at the face edge", () => {
  const store = setup();
  // The head front and right side share the skin color at their border.
  const outside = pixel(store, 7, 12);
  assert.deepEqual(pixel(store, 8, 12), outside);
  assert.equal(store.fill(settings(), 8, 12), true);
  assert.deepEqual(pixel(store, 8, 12), [200, 10, 10, 255]);
  assert.deepEqual(pixel(store, 7, 12), outside);
  // Eyes are a different color and stay.
  assert.notDeepEqual(pixel(store, 10, 12), [200, 10, 10, 255]);
  store.undo();
  assert.deepEqual(pixel(store, 8, 12), outside);
});

test("model changes are undoable and history drops the oldest step at the limit", () => {
  const store = setup();
  store.setVariant("slim");
  assert.equal(store.getSnapshot().variant, "slim");
  store.undo();
  assert.equal(store.getSnapshot().variant, "classic");
  for (let i = 0; i <= HISTORY_LIMIT; i++) {
    store.beginStroke("pencil", settings({ color: [i, 0, 0, 255] }), 9, 9);
    store.endStroke();
  }
  let undone = 0;
  while (store.undo()) undone++;
  assert.equal(undone, HISTORY_LIMIT);
  assert.deepEqual(pixel(store, 9, 9), [0, 0, 0, 255]);
});

test("a cancelled stroke restores its pixels and leaves no undo step", () => {
  const store = setup();
  const before = store.pixels.slice();
  store.beginStroke("pencil", settings(), 9, 9);
  store.strokeTo(12, 9);
  store.cancelStroke();
  assert.deepEqual(store.pixels, before);
  assert.equal(store.getSnapshot().canUndo, false);
});

test("opening another skin is one undo step that restores pixels and model", () => {
  const store = setup("classic");
  const before = store.pixels.slice();
  store.replace(createTemplate("slim"));
  assert.equal(store.getSnapshot().variant, "slim");
  assert.notDeepEqual(store.pixels, before);
  store.undo();
  assert.equal(store.getSnapshot().variant, "classic");
  assert.deepEqual(store.pixels, before);
});
