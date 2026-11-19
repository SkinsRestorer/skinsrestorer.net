import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allPartsVisible,
  brushArea,
  brushPixels,
  brushSquare,
  defaultBrush,
  fillFace,
  fillTargets,
  SHADE_STEP,
  SHADE_STEPS,
  shadeColor,
  toolFootprint,
  type PaintSettings,
  type Rgba,
} from "./skin-paint";
import { PatchBuilder } from "./skin-history";
import {
  findRegion,
  mirrorPixel,
  regionAt,
  SKIN_SIZE,
  skinRegions,
} from "./skin-regions";
import { required } from "./utils";

function settings(overrides: Partial<PaintSettings> = {}): PaintSettings {
  return {
    layer: "base",
    color: [1, 2, 3, 255],
    visibility: allPartsVisible(),
    ...defaultBrush,
    ...overrides,
  };
}

const xy = (index: number): [number, number] => [
  index % SKIN_SIZE,
  Math.floor(index / SKIN_SIZE),
];
const byPoint = (a: readonly [number, number], b: readonly [number, number]) =>
  a[0] - b[0] || a[1] - b[1];

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
          const mirror = required(
            mirrorPixel(variant, x, y),
            "mirrorPixel result",
          );
          const target = required(
            regionAt(variant, mirror.x, mirror.y),
            "regionAt result",
          );
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
    overlap.map((index) => xy(index)).toSorted(byPoint),
    (
      [
        [11, 9],
        [11, 10],
        [12, 9],
        [12, 10],
      ] satisfies [number, number][]
    ).toSorted(byPoint),
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
    [...new Set(wide.map((i) => xy(i)[0]))].toSorted((a, b) => a - b),
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
  assert.deepEqual(area.mirror, { x: 39, y: 52, width: 1, height: 2 });
  // Every mirrored pixel is the mirror of a source pixel.
  const pixels = brushPixels(
    "slim",
    settings({ size: 5, mirror: true }),
    42,
    22,
  );
  const sources = new Set(
    pixels.filter((i) => regionAt("slim", ...xy(i))?.part === "rightArm"),
  );
  for (const index of pixels.filter((i) => !sources.has(i))) {
    const [x, y] = xy(index);
    const back = required(mirrorPixel("slim", x, y), "mirrorPixel result");
    assert.ok(sources.has(back.y * SKIN_SIZE + back.x));
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
  assert.equal(area.mirror, undefined);
  // The outer layer of the left arm is still a valid mirror target.
  const outer = brushArea(
    "classic",
    settings({ layer: "outer", mirror: true, visibility: hidden }),
    44,
    37,
  );
  const outerMirror = required(outer?.mirror, "outer mirror");
  assert.equal(
    regionAt("classic", outerMirror.x, outerMirror.y)?.layer,
    "outer",
  );
  // A pixel of the other layer is not a brush anchor.
  assert.deepEqual(
    brushPixels("classic", settings({ mirror: true }), 44, 37),
    [],
  );
});

const hue = (c: Rgba) => {
  const [r, g, b] = c;
  return Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b);
};

test("shading keeps hue and alpha, clamps at black and white, and skips clear pixels", () => {
  const base: Rgba = [180, 60, 40, 200];
  const darker = required(shadeColor(base, "darken"), "shadeColor result");
  const lighter = required(shadeColor(base, "lighten"), "shadeColor result");
  assert.equal(darker[3], 200);
  assert.equal(lighter[3], 200);
  assert.ok(darker[0] < base[0] && lighter[0] > base[0]);
  assert.ok(Math.abs(hue(darker) - hue(base)) < 0.03);
  assert.ok(Math.abs(hue(lighter) - hue(base)) < 0.03);
  // Grey stays grey.
  const grey = required(
    shadeColor([128, 128, 128, 255], "darken"),
    "shadeColor result",
  );
  assert.equal(grey[0], grey[1]);
  assert.equal(grey[1], grey[2]);
  // Repeated shading ends at black or white and stays there.
  let dark: Rgba = base;
  let light: Rgba = base;
  for (let i = 0; i < 20; i++) {
    dark = required(shadeColor(dark, "darken"), "shadeColor result");
    light = required(shadeColor(light, "lighten"), "shadeColor result");
  }
  assert.deepEqual(dark, [0, 0, 0, 200]);
  assert.deepEqual(light, [255, 255, 255, 200]);
  assert.equal(shadeColor([10, 20, 30, 0], "lighten"), undefined);
  // Every result is a valid byte.
  for (const channel of required(
    shadeColor([255, 0, 7, 1], "lighten"),
    "shadeColor result",
  ))
    assert.ok(Number.isInteger(channel) && channel >= 0 && channel <= 255);
});

test("Everywhere replaces the exact RGBA on visible parts of the active layer only", () => {
  const pixels = new Uint8ClampedArray(SKIN_SIZE * SKIN_SIZE * 4);
  const target = [9, 9, 9, 255] as const;
  const nearly = [9, 9, 10, 255] as const;
  // Every pixel, used or not, on both layers starts with the target color.
  for (let i = 0; i < SKIN_SIZE * SKIN_SIZE; i++) pixels.set(target, i * 4);
  pixels.set(nearly, (20 * SKIN_SIZE + 20) * 4); // body front, base
  const visibility = allPartsVisible();
  visibility.leftLeg.base = false;
  const builder = new PatchBuilder(pixels);
  fillFace(
    pixels,
    builder,
    "slim",
    settings({
      fillScope: "everywhere",
      mirror: true,
      color: [1, 2, 3, 40],
      visibility,
    }),
    8,
    8,
  );
  for (let i = 0; i < SKIN_SIZE * SKIN_SIZE; i++) {
    const [x, y] = xy(i);
    const region = regionAt("slim", x, y);
    const value = Array.from(pixels.subarray(i * 4, i * 4 + 4));
    if (
      region?.layer === "base" &&
      visibility[region.part].base &&
      !(x === 20 && y === 20)
    )
      // Base paint stays opaque.
      assert.deepEqual(value, [1, 2, 3, 255], `${x},${y}`);
    else if (x === 20 && y === 20) assert.deepEqual(value, [...nearly]);
    else assert.deepEqual(value, [...target], `${x},${y} must not change`);
  }
  assert.equal(
    required(builder.finish(), "finish result").indices.length > 1000,
    true,
  );
});

test("Everywhere ignores mirror, so no pixel of another color changes", () => {
  const pixels = new Uint8ClampedArray(SKIN_SIZE * SKIN_SIZE * 4);
  for (let i = 0; i < SKIN_SIZE * SKIN_SIZE; i++)
    pixels.set([50, 50, 50, 255], i * 4);
  pixels.set([7, 7, 7, 255], (20 * SKIN_SIZE + 44) * 4); // right arm front
  const targets = fillTargets(
    pixels,
    "classic",
    settings({ fillScope: "everywhere", mirror: true }),
    44,
    20,
  );
  assert.deepEqual(targets, { source: [20 * SKIN_SIZE + 44], mirror: [] });
  // Face scope still mirrors.
  const face = required(
    fillTargets(pixels, "classic", settings({ mirror: true }), 44, 20),
    "fillTargets result",
  );
  assert.deepEqual(face.source, [20 * SKIN_SIZE + 44]);
  const other = required(mirrorPixel("classic", 44, 20), "mirrorPixel result");
  assert.deepEqual(face.mirror, [other.y * SKIN_SIZE + other.x]);
});

const lightness = (c: Rgba) =>
  (Math.max(c[0], c[1], c[2]) + Math.min(c[0], c[1], c[2])) / 510;

test("shade strength keeps hue and alpha, skips clear pixels, clamps, and medium is the old step", () => {
  const color: Rgba = [180, 90, 60, 170];
  assert.equal(SHADE_STEPS.medium, SHADE_STEP);
  assert.equal(defaultBrush.shadeStrength, "medium");
  assert.deepEqual(
    shadeColor(color, "darken"),
    shadeColor(color, "darken", SHADE_STEPS.medium),
  );
  const delta = (strength: keyof typeof SHADE_STEPS) =>
    lightness(color) -
    lightness(
      required(
        shadeColor(color, "darken", SHADE_STEPS[strength]),
        "shadeColor result",
      ),
    );
  const [soft, medium, strong] = [
    delta("soft"),
    delta("medium"),
    delta("strong"),
  ] as const;
  assert.ok(soft < medium && medium < strong);
  assert.ok(Math.abs(soft - 0.04) < 0.01);
  assert.ok(Math.abs(strong - 0.16) < 0.01);
  for (const strength of ["soft", "medium", "strong"] as const) {
    const shaded = required(
      shadeColor(color, "lighten", SHADE_STEPS[strength]),
      "shadeColor result",
    );
    assert.equal(shaded[3], 170);
    assert.ok(shaded[0] > shaded[1] && shaded[1] > shaded[2], "same hue order");
    assert.equal(
      shadeColor([1, 2, 3, 0], "darken", SHADE_STEPS[strength]),
      undefined,
    );
  }
  assert.deepEqual(
    shadeColor([250, 250, 250, 255], "lighten", 0.16),
    [255, 255, 255, 255],
  );
  assert.deepEqual(shadeColor([5, 5, 5, 255], "darken", 0.16), [0, 0, 0, 255]);
});

test("the 3D footprint matches the brush, face lock, mirror, and fill", () => {
  const pixels = new Uint8ClampedArray(SKIN_SIZE * SKIN_SIZE * 4);
  const brush = settings({ size: 3, mirror: true });
  // Arm front corner: the square is clipped to the face.
  const area = required(
    toolFootprint(pixels, "classic", "pencil", brush, 44, 20),
    "toolFootprint result",
  );
  assert.deepEqual(
    new Set(area.source),
    new Set(brushPixels("classic", { ...brush, mirror: false }, 44, 20)),
  );
  assert.deepEqual(
    new Set([...area.source, ...area.mirror]),
    new Set(brushPixels("classic", brush, 44, 20)),
  );
  assert.ok(
    area.source.every((i) => regionAt("classic", ...xy(i))?.face === "front"),
  );
  assert.equal(
    toolFootprint(pixels, "classic", "eraser", brush, 44, 20),
    undefined,
  );
  assert.equal(
    toolFootprint(pixels, "classic", "pencil", brush, 60, 20),
    undefined,
    "unused pixel",
  );
  const fill = required(
    toolFootprint(pixels, "classic", "fill", settings(), 8, 8),
    "toolFootprint result",
  );
  assert.equal(fill.source.length, 64);
  assert.deepEqual(
    toolFootprint(pixels, "classic", "eyedropper", brush, 8, 8),
    {
      source: [8 * SKIN_SIZE + 8],
      mirror: [],
    },
  );
});

test("fill treats clear pixels with different hidden RGB as one area", () => {
  const pixels = new Uint8ClampedArray(SKIN_SIZE * SKIN_SIZE * 4);
  const front = findRegion("classic", "head", "outer", "front");
  // Imported files often keep varied RGB under alpha 0.
  for (let y = front.y; y < front.y + front.height; y++)
    for (let x = front.x; x < front.x + front.width; x++)
      pixels.set([x * 3, y * 5, 7, 0], (y * SKIN_SIZE + x) * 4);
  // One visible pixel stays outside the fill.
  const solid = (front.y * SKIN_SIZE + front.x) * 4;
  pixels.set([9, 9, 9, 255], solid);
  const outer = settings({ layer: "outer", color: [200, 10, 10, 128] });

  const face = required(
    fillTargets(pixels, "classic", outer, front.x + 3, front.y + 3),
    "fillTargets result",
  );
  assert.equal(face.source.length, front.width * front.height - 1);

  const everywhere = required(
    fillTargets(
      pixels,
      "classic",
      { ...outer, fillScope: "everywhere" },
      front.x + 3,
      front.y + 3,
    ),
    "fillTargets result",
  );
  // Every other outer pixel is clear [0, 0, 0, 0] and joins the fill too.
  const outerPixels = skinRegions("classic")
    .filter((region) => region.layer === "outer")
    .reduce((sum, region) => sum + region.width * region.height, 0);
  assert.equal(everywhere.source.length, outerPixels - 1);
  assert.equal(everywhere.source.includes(solid / 4), false);

  // A visible color still matches its exact RGBA only.
  const exact = required(
    fillTargets(pixels, "classic", outer, front.x, front.y),
    "fillTargets result",
  );
  assert.deepEqual(exact.source, [solid / 4]);
});
