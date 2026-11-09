import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allPartsVisible,
  brushArea,
  brushPixels,
  brushSquare,
  defaultBrush,
  shadeColor,
  type PaintSettings,
  type Rgba,
} from "./skin-paint";
import {
  findRegion,
  mirrorPixel,
  regionAt,
  SKIN_SIZE,
  skinRegions,
} from "./skin-regions";

function settings(overrides: Partial<PaintSettings> = {}): PaintSettings {
  return {
    layer: "base",
    color: [1, 2, 3, 255],
    visibility: allPartsVisible(),
    ...defaultBrush,
    ...overrides,
  };
}

const xy = (index: number) => [
  index % SKIN_SIZE,
  Math.floor(index / SKIN_SIZE),
];

for (const variant of ["classic", "slim"] as const) {
  test(`${variant} mirror maps every used pixel to its counterpart face and back`, () => {
    const pairs = {
      head: "head",
      body: "body",
      rightArm: "leftArm",
      leftArm: "rightArm",
      rightLeg: "leftLeg",
      leftLeg: "rightLeg",
    } as const;
    const sides = { left: "right", right: "left" } as const;
    let count = 0;
    for (const region of skinRegions(variant))
      for (let y = region.y; y < region.y + region.height; y++)
        for (let x = region.x; x < region.x + region.width; x++) {
          const mirror = mirrorPixel(variant, x, y)!;
          const target = regionAt(variant, mirror.x, mirror.y)!;
          assert.equal(target.part, pairs[region.part]);
          assert.equal(target.layer, region.layer);
          assert.equal(
            target.face,
            region.face === "left" || region.face === "right"
              ? sides[region.face]
              : region.face,
          );
          // Rows stay; columns reverse.
          assert.equal(mirror.y - target.y, y - region.y);
          assert.equal(mirror.x - target.x, region.width - 1 - (x - region.x));
          assert.deepEqual(mirrorPixel(variant, mirror.x, mirror.y), { x, y });
          // Java widths are even or swap parts, so no pixel mirrors to itself.
          assert.notDeepEqual(mirror, { x, y });
          count++;
        }
    assert.equal(count, variant === "classic" ? 3264 : 3136);
    assert.equal(mirrorPixel(variant, 0, 0), undefined);
    assert.equal(mirrorPixel(variant, 63, 63 - 15), undefined);
  });
}

test("brush squares center odd sizes and reach up and left for even sizes", () => {
  assert.deepEqual(brushSquare(10, 10, 1), {
    x: 10,
    y: 10,
    width: 1,
    height: 1,
  });
  assert.deepEqual(brushSquare(10, 10, 2), { x: 9, y: 9, width: 2, height: 2 });
  assert.deepEqual(brushSquare(10, 10, 3), { x: 9, y: 9, width: 3, height: 3 });
  assert.deepEqual(brushSquare(10, 10, 4), { x: 8, y: 8, width: 4, height: 4 });
  assert.deepEqual(brushSquare(10, 10, 8), { x: 6, y: 6, width: 8, height: 8 });
  // Sizes outside the range are clamped.
  assert.equal(brushSquare(10, 10, 0).width, 1);
  assert.equal(brushSquare(10, 10, 20).width, 8);
});

test("a large brush stays inside the face under the pointer", () => {
  // Head front is 8..15 × 8..15. A size 8 brush at its corner covers 4×4.
  const pixels = brushPixels("classic", settings({ size: 8 }), 8, 8);
  assert.equal(pixels.length, 16);
  for (const index of pixels) {
    const [x, y] = xy(index);
    assert.ok(x >= 8 && x <= 11 && y >= 8 && y <= 11, `${x},${y}`);
  }
  // On an unused pixel the brush does nothing, even if it overlaps a face.
  assert.deepEqual(brushPixels("classic", settings({ size: 8 }), 0, 0), []);
  // A surface lock on another face blocks the brush.
  const left = findRegion("classic", "head", "base", "left");
  assert.deepEqual(brushPixels("classic", settings(), 9, 9, left), []);
});

test("a mirrored brush is the reflection of the clipped square, with each pixel once", () => {
  // Size 2 on the head front at x 12: columns 11–12 mirror to 11–12.
  const overlap = brushPixels(
    "classic",
    settings({ size: 2, mirror: true }),
    12,
    10,
  );
  assert.deepEqual(
    overlap.map(xy).sort(),
    [
      [11, 9],
      [11, 10],
      [12, 9],
      [12, 10],
    ].sort(),
  );
  // Size 3 at x 12 covers 11–13 and mirrors to 10–12: four columns, no repeats.
  const wide = brushPixels(
    "classic",
    settings({ size: 3, mirror: true }),
    12,
    10,
  );
  assert.equal(new Set(wide).size, wide.length);
  assert.deepEqual(
    [...new Set(wide.map((i) => xy(i)[0]))].sort(),
    [10, 11, 12, 13],
  );
  // Right arm front (44..47, 20..31) mirrors to the left arm front (36..39, 52..63).
  const area = brushArea(
    "classic",
    settings({ size: 2, mirror: true }),
    44,
    21,
  );
  assert.deepEqual(area?.source, { x: 44, y: 20, width: 1, height: 2 });
  assert.deepEqual(area?.mirror, { x: 39, y: 52, width: 1, height: 2 });
  // Every mirrored pixel is the mirror of a source pixel.
  const pixels = brushPixels(
    "slim",
    settings({ size: 5, mirror: true }),
    42,
    22,
  );
  const sources = pixels.filter(
    (i) =>
      regionAt("slim", ...(xy(i) as [number, number]))?.part === "rightArm",
  );
  for (const index of pixels.filter((i) => !sources.includes(i))) {
    const [x, y] = xy(index);
    const back = mirrorPixel("slim", x, y)!;
    assert.ok(sources.includes(back.y * SKIN_SIZE + back.x));
  }
});

test("the mirror skips hidden counterparts and the inactive layer", () => {
  const hidden = allPartsVisible();
  hidden.leftArm.base = false;
  const area = brushArea(
    "classic",
    settings({ mirror: true, visibility: hidden }),
    44,
    21,
  );
  assert.ok(area?.source);
  assert.equal(area?.mirror, undefined);
  // The outer layer of the left arm is still a valid mirror target.
  const outer = brushArea(
    "classic",
    settings({ layer: "outer", mirror: true, visibility: hidden }),
    44,
    37,
  );
  assert.equal(
    regionAt("classic", outer!.mirror!.x, outer!.mirror!.y)?.layer,
    "outer",
  );
  // A pixel of the other layer is not a brush anchor.
  assert.deepEqual(
    brushPixels("classic", settings({ mirror: true }), 44, 37),
    [],
  );
});

test("shading keeps hue and alpha, clamps at black and white, and skips clear pixels", () => {
  const hue = (c: Rgba) => {
    const [r, g, b] = c;
    return Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b);
  };
  const base: Rgba = [180, 60, 40, 200];
  const darker = shadeColor(base, "darken")!;
  const lighter = shadeColor(base, "lighten")!;
  assert.equal(darker[3], 200);
  assert.equal(lighter[3], 200);
  assert.ok(darker[0] < base[0] && lighter[0] > base[0]);
  assert.ok(Math.abs(hue(darker) - hue(base)) < 0.03);
  assert.ok(Math.abs(hue(lighter) - hue(base)) < 0.03);
  // Grey stays grey.
  const grey = shadeColor([128, 128, 128, 255], "darken")!;
  assert.equal(grey[0], grey[1]);
  assert.equal(grey[1], grey[2]);
  // Repeated shading ends at black or white and stays there.
  let dark: Rgba = base;
  let light: Rgba = base;
  for (let i = 0; i < 20; i++) {
    dark = shadeColor(dark, "darken")!;
    light = shadeColor(light, "lighten")!;
  }
  assert.deepEqual(dark, [0, 0, 0, 200]);
  assert.deepEqual(light, [255, 255, 255, 200]);
  assert.equal(shadeColor([10, 20, 30, 0], "lighten"), undefined);
  // Every result is a valid byte.
  for (const channel of shadeColor([255, 0, 7, 1], "lighten")!)
    assert.ok(Number.isInteger(channel) && channel >= 0 && channel <= 255);
});
