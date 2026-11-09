import assert from "node:assert/strict";
import { test } from "node:test";
import { createTemplate, pixelOffset } from "./skin-document";
import { SkinEditorStore } from "./skin-editor-store";
import { HISTORY_LIMIT } from "./skin-history";
import {
  allPartsVisible,
  defaultBrush,
  shadeColor,
  type PaintSettings,
} from "./skin-paint";
import { mirrorPixel, SKIN_SIZE } from "./skin-regions";

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
    ...defaultBrush,
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

const changedPixels = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
  const changed: number[] = [];
  for (let i = 0; i < SKIN_SIZE * SKIN_SIZE; i++)
    if ([0, 1, 2, 3].some((c) => a[i * 4 + c] !== b[i * 4 + c]))
      changed.push(i);
  return changed;
};

test("size 1 without mirror paints exactly the pixels on the line", () => {
  const store = setup();
  const before = store.pixels.slice();
  store.beginStroke("pencil", settings(), 9, 9);
  store.strokeTo(13, 9);
  store.endStroke();
  assert.deepEqual(
    changedPixels(before, store.pixels),
    [9, 10, 11, 12, 13].map((x) => 9 * SKIN_SIZE + x),
  );
});

test("a fast large-brush stroke leaves no gaps and is one undo step", () => {
  const store = setup();
  const before = store.pixels.slice();
  // Body front is 20..27 × 20..31. One jump down the middle with size 3.
  store.beginStroke("pencil", settings({ size: 3 }), 23, 21);
  store.strokeTo(23, 30);
  store.endStroke();
  for (let y = 20; y <= 31; y++)
    for (const x of [22, 23, 24])
      assert.deepEqual(pixel(store, x, y), [200, 10, 10, 255], `${x},${y}`);
  assert.deepEqual(
    pixel(store, 21, 25),
    Array.from(before.subarray((25 * 64 + 21) * 4, (25 * 64 + 21) * 4 + 4)),
  );
  store.undo();
  assert.deepEqual(store.pixels, before);
  assert.equal(store.getSnapshot().canUndo, false);
  store.redo();
  assert.deepEqual(pixel(store, 23, 31), [200, 10, 10, 255]);
});

test("mirror painting writes both sides in one undo step and keeps the shape", () => {
  for (const variant of ["classic", "slim"] as const) {
    const store = setup(variant);
    const before = store.pixels.slice();
    // A size 2 stroke down the right arm front, base layer.
    store.beginStroke("pencil", settings({ size: 2, mirror: true }), 45, 20);
    store.strokeTo(45, 25);
    store.endStroke();
    const changed = changedPixels(before, store.pixels);
    const set = new Set(changed);
    for (const index of changed) {
      const m = mirrorPixel(variant, index % 64, Math.floor(index / 64))!;
      assert.ok(set.has(m.y * 64 + m.x), `${variant} ${index}`);
    }
    assert.ok(changed.some((i) => i % 64 < 40 && Math.floor(i / 64) >= 52));
    assert.equal(store.undo(), true);
    assert.deepEqual(store.pixels, before);
    assert.equal(store.getSnapshot().canUndo, false);
  }
});

test("mirror painting never touches a hidden counterpart or the 3D lock's other faces", () => {
  const store = setup();
  const before = store.pixels.slice();
  const hidden = allPartsVisible();
  hidden.leftLeg.base = false;
  store.beginStroke(
    "pencil",
    settings({ size: 8, mirror: true, visibility: hidden }),
    5,
    25,
    { surfaceLock: true },
  );
  store.strokeTo(7, 30);
  store.endStroke();
  const changed = changedPixels(before, store.pixels);
  assert.ok(changed.length > 0);
  // Right leg front only (4..7 × 20..31); no left leg, no other face.
  for (const index of changed) {
    const x = index % 64;
    const y = Math.floor(index / 64);
    assert.ok(x >= 4 && x <= 7 && y >= 20 && y <= 31, `${x},${y}`);
  }
});

test("mirror fill fills the reflected shape and skips hidden parts", () => {
  const store = setup();
  const before = store.pixels.slice();
  assert.equal(store.fill(settings({ mirror: true }), 44, 25), true);
  const changed = new Set(changedPixels(before, store.pixels));
  for (const index of changed) {
    const m = mirrorPixel("classic", index % 64, Math.floor(index / 64))!;
    assert.ok(changed.has(m.y * 64 + m.x));
  }
  store.undo();
  assert.deepEqual(store.pixels, before);
  const hidden = allPartsVisible();
  hidden.leftArm.base = false;
  store.fill(settings({ mirror: true, visibility: hidden }), 44, 25);
  for (const index of changedPixels(before, store.pixels))
    assert.ok(Math.floor(index / 64) < 48, `left arm changed at ${index}`);
});

test("shade changes each pixel once per stroke, also where the mirror overlaps", () => {
  const store = setup();
  const before = store.pixels.slice();
  const shade = settings({ size: 3, mirror: true, shade: "darken" });
  // A slow back-and-forth drag across the head front center.
  store.beginStroke("shade", shade, 11, 12);
  for (const x of [12, 11, 12, 11, 12]) store.strokeTo(x, 12);
  store.endStroke();
  const changed = changedPixels(before, store.pixels);
  assert.ok(changed.length > 0);
  for (const index of changed) {
    const at = index * 4;
    const old = [
      before[at],
      before[at + 1],
      before[at + 2],
      before[at + 3],
    ] as const;
    assert.deepEqual(
      Array.from(store.pixels.subarray(at, at + 4)),
      shadeColor(old, "darken"),
    );
  }
  // One undo step, then a new stroke can shade again.
  store.undo();
  assert.deepEqual(store.pixels, before);
  store.redo();
  const once = pixel(store, 11, 12);
  store.beginStroke("shade", shade, 11, 12);
  store.endStroke();
  assert.deepEqual(
    pixel(store, 11, 12),
    shadeColor(once as unknown as [number, number, number, number], "darken"),
  );
});

test("shade keeps alpha, skips clear pixels, and works on the base layer", () => {
  const store = setup();
  // A half-clear and a clear outer pixel on the head top (40..47 × 0..7).
  store.beginStroke(
    "pencil",
    settings({ layer: "outer", color: [100, 150, 200, 90] }),
    41,
    2,
  );
  store.endStroke();
  const clear = pixel(store, 42, 2);
  assert.equal(clear[3], 0);
  store.beginStroke(
    "shade",
    settings({ layer: "outer", size: 3, shade: "lighten" }),
    42,
    2,
  );
  store.endStroke();
  assert.deepEqual(pixel(store, 42, 2), clear);
  assert.equal(pixel(store, 41, 2)[3], 90);
  assert.ok(pixel(store, 41, 2)[2] > 200);
  // Base pixels stay opaque.
  store.beginStroke("shade", settings({ shade: "lighten" }), 9, 9);
  store.endStroke();
  assert.equal(pixel(store, 9, 9)[3], 255);
});

test("a cancelled mirrored shade stroke restores both sides", () => {
  const store = setup();
  const before = store.pixels.slice();
  store.beginStroke("shade", settings({ size: 4, mirror: true }), 44, 25);
  store.strokeTo(46, 28);
  assert.notDeepEqual(store.pixels, before);
  store.cancelStroke();
  assert.deepEqual(store.pixels, before);
  assert.equal(store.getSnapshot().canUndo, false);
});
