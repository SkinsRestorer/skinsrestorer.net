import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describePixel,
  regionAt,
  SKIN_SIZE,
  skinRegions,
} from "./skin-regions";

for (const [variant, perLayer] of [
  ["classic", 1632],
  ["slim", 1568],
] as const) {
  test(`${variant} layers have ${perLayer} usable pixels and no overlaps`, () => {
    for (const layer of ["base", "outer"] as const) {
      const seen = new Set<number>();
      let count = 0;
      for (const region of skinRegions(variant).filter(
        (r) => r.layer === layer,
      ))
        for (let y = region.y; y < region.y + region.height; y++)
          for (let x = region.x; x < region.x + region.width; x++) {
            assert.ok(x < SKIN_SIZE && y < SKIN_SIZE);
            const index = y * SKIN_SIZE + x;
            assert.ok(
              !seen.has(index),
              `${variant} ${layer} overlap at ${x},${y}`,
            );
            seen.add(index);
            count++;
          }
      assert.equal(count, perLayer);
    }
  });
}

test("pixel lookup names the face, the layer, and unused areas", () => {
  assert.equal(regionAt("classic", 10, 12)?.face, "front");
  assert.equal(regionAt("classic", 10, 12)?.part, "head");
  assert.equal(regionAt("classic", 42, 10)?.layer, "outer");
  assert.equal(regionAt("classic", 0, 0), undefined);
  // The fourth arm column belongs to classic arms only.
  assert.equal(regionAt("classic", 47, 20)?.part, "rightArm");
  assert.equal(regionAt("slim", 47, 20)?.part, "rightArm");
  assert.equal(regionAt("slim", 54, 20), undefined);
  assert.equal(regionAt("classic", 54, 20)?.face, "back");
  assert.equal(regionAt("classic", 64, 0), undefined);
  assert.equal(
    describePixel("classic", 10, 12),
    "Head front, base layer, x 10, y 12",
  );
  assert.equal(describePixel("classic", 0, 0), "Unused area, x 0, y 0");
});
