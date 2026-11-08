import assert from "node:assert/strict";
import { test } from "node:test";
import { checkSkin, repairSkin } from "./skin-check";
import { createTemplate, pixelOffset } from "./skin-document";
import { SkinEditorStore } from "./skin-editor-store";
import { findRegion } from "./skin-regions";

function storeWith(
  variant: "classic" | "slim",
  edit: (p: Uint8ClampedArray) => void,
) {
  const document = createTemplate(variant);
  edit(document.pixels);
  const store = new SkinEditorStore();
  store.load(document);
  return store;
}

const ids = (pixels: Uint8ClampedArray, variant: "classic" | "slim") =>
  checkSkin(pixels, variant).map((issue) => issue.id);

test("see-through base pixels are reported, kept, and repaired as one undo step", () => {
  const store = storeWith("classic", (p) => {
    p.set([30, 40, 50, 0], pixelOffset(10, 10));
    p.set([60, 70, 80, 100], pixelOffset(11, 10));
  });
  const imported = store.pixels.slice();
  assert.deepEqual(ids(store.pixels, "classic"), ["transparent-base"]);
  // Checking alone never changes pixels.
  assert.deepEqual(store.pixels, imported);
  store.apply((pixels, builder) =>
    repairSkin("transparent-base", pixels, "classic", builder),
  );
  assert.deepEqual(
    [...store.pixels.subarray(pixelOffset(10, 10), pixelOffset(10, 10) + 4)],
    [30, 40, 50, 255],
  );
  assert.deepEqual(
    [...store.pixels.subarray(pixelOffset(11, 10), pixelOffset(11, 10) + 4)],
    [60, 70, 80, 255],
  );
  assert.deepEqual(ids(store.pixels, "classic"), []);
  store.undo();
  assert.deepEqual(store.pixels, imported);
});

test("pixels outside every body part can be cleared", () => {
  const store = storeWith("classic", (p) =>
    p.set([1, 2, 3, 255], pixelOffset(0, 0)),
  );
  assert.deepEqual(ids(store.pixels, "classic"), ["unused-pixels"]);
  store.apply((pixels, builder) =>
    repairSkin("unused-pixels", pixels, "classic", builder),
  );
  assert.deepEqual(ids(store.pixels, "classic"), []);
});

test("a possible model mismatch only suggests a model and never offers to erase arm pixels", () => {
  // A classic skin opened as slim: the fourth arm column has pixels.
  const store = storeWith("classic", () => undefined);
  store.setVariant("slim");
  const issues = checkSkin(store.pixels, "slim");
  assert.deepEqual(
    issues.map((i) => i.id),
    ["possible-classic"],
  );
  assert.equal(issues[0].repair, undefined);
  assert.equal(issues[0].switchVariant, "classic");
  const before = store.pixels.slice();
  store.apply((pixels, builder) =>
    repairSkin("unused-pixels", pixels, "slim", builder),
  );
  assert.deepEqual(store.pixels, before);

  // A slim skin opened as classic gets the opposite hint, not a base repair.
  const slim = createTemplate("slim");
  assert.deepEqual(ids(slim.pixels, "classic"), ["possible-slim"]);
});

test("a fully opaque outer layer is not an issue", () => {
  const store = storeWith("classic", (pixels) => {
    const hat = findRegion("classic", "head", "outer", "front");
    for (let y = hat.y; y < hat.y + hat.height; y++)
      for (let x = hat.x; x < hat.x + hat.width; x++)
        pixels.set([5, 5, 5, 255], pixelOffset(x, y));
  });
  assert.deepEqual(ids(store.pixels, "classic"), []);
});
