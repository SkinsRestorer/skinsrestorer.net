import assert from "node:assert/strict";
import { test } from "node:test";
import { createTemplate } from "@/lib/skin-document";
import { SkinEditorStore } from "@/lib/skin-editor-store";
import { allPartsVisible, defaultBrush, toolFootprint } from "@/lib/skin-paint";
import { SKIN_SIZE } from "@/lib/skin-regions";
import { copyFlipped, paintOverlay } from "./model-canvas";

test("the hover footprint changes only the GPU copy, never the document", () => {
  const store = new SkinEditorStore();
  store.load(createTemplate("classic"));
  const document = store.pixels.slice();
  const revision = store.getSnapshot().revision;
  const area = toolFootprint(
    store.pixels,
    "classic",
    "pencil",
    {
      layer: "outer",
      color: [1, 2, 3, 255],
      visibility: allPartsVisible(),
      ...defaultBrush,
      size: 3,
      mirror: true,
    },
    44,
    36,
  )!;
  const gpu = new Uint8Array(SKIN_SIZE * SKIN_SIZE * 4);
  copyFlipped(store.pixels, gpu);
  const plain = gpu.slice();
  paintOverlay(gpu, { ...area, blocked: [8 * SKIN_SIZE + 40] });
  assert.deepEqual(store.pixels, document);
  assert.equal(store.getSnapshot().revision, revision);
  assert.equal(store.getSnapshot().canUndo, false);
  // Rows are flipped in the GPU copy.
  const at = (x: number, y: number) =>
    ((SKIN_SIZE - 1 - y) * SKIN_SIZE + x) * 4;
  const changed = (x: number, y: number) =>
    [0, 1, 2, 3].some((c) => gpu[at(x, y) + c] !== plain[at(x, y) + c]);
  // A clear outer pixel under the brush becomes visible on the model.
  assert.equal(store.pixels[(36 * SKIN_SIZE + 44) * 4 + 3], 0);
  assert.ok(gpu[at(44, 36) + 3] >= 200);
  for (const index of [...area.source, ...area.mirror, 8 * SKIN_SIZE + 40])
    assert.ok(changed(index % SKIN_SIZE, Math.floor(index / SKIN_SIZE)));
  assert.equal(changed(0, 0), false);
  // Blocked pixels are tinted red.
  assert.ok(gpu[at(40, 8)] > gpu[at(40, 8) + 1]);
});
