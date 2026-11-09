import assert from "node:assert/strict";
import { test } from "node:test";
import { SkinObject } from "skinview3d/libs/model.js";
import { Box3, Vector3, type Mesh } from "three";
import type { SkinVariant } from "./skin";
import { checkSkin } from "./skin-check";
import { createTemplate } from "./skin-document";
import { SkinEditorStore } from "./skin-editor-store";
import { PatchBuilder } from "./skin-history";
import { allPartsVisible } from "./skin-paint";
import {
  flipPixel,
  pairedPixel,
  regionAt,
  SKIN_SIZE,
  type SkinPart,
} from "./skin-regions";
import { convertArms, transformPart } from "./skin-transform";

interface Surface {
  readonly part: SkinPart;
  readonly layer: "base" | "outer";
  readonly normal: Vector3;
  readonly point: Vector3;
  readonly center: Vector3;
}

const parts: readonly SkinPart[] = [
  "head",
  "body",
  "rightArm",
  "leftArm",
  "rightLeg",
  "leftLeg",
];

/**
 * Where each texture pixel center lies on the skinview3d model. This reads
 * only the dependency's mesh vertices, normals, and UVs, and none of the
 * editor's face tables.
 */
function surfaces(variant: SkinVariant) {
  const skin = new SkinObject();
  skin.modelType = variant === "slim" ? "slim" : "default";
  skin.updateMatrixWorld(true);
  const map = new Map<number, Surface>();
  for (const part of parts)
    for (const layer of ["base", "outer"] as const) {
      const mesh = (
        layer === "base" ? skin[part].innerLayer : skin[part].outerLayer
      ) as Mesh;
      const center = new Box3().setFromObject(mesh).getCenter(new Vector3());
      const geometry = mesh.geometry;
      const index = geometry.index!;
      const positions = geometry.getAttribute("position");
      const uvs = geometry.getAttribute("uv");
      const normals = geometry.getAttribute("normal");
      for (let triangle = 0; triangle < index.count; triangle += 3) {
        const ids = [0, 1, 2].map((i) => index.getX(triangle + i));
        const [a, b, c] = ids.map((id) => [uvs.getX(id), uvs.getY(id)]);
        const area =
          (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
        const normal = new Vector3()
          .fromBufferAttribute(normals, ids[0])
          .transformDirection(mesh.matrixWorld)
          .round();
        const vertices = ids.map((id) =>
          new Vector3()
            .fromBufferAttribute(positions, id)
            .applyMatrix4(mesh.matrixWorld),
        );
        for (let y = 0; y < SKIN_SIZE; y++)
          for (let x = 0; x < SKIN_SIZE; x++) {
            const u = (x + 0.5) / SKIN_SIZE;
            const v = 1 - (y + 0.5) / SKIN_SIZE;
            const wa =
              ((b[1] - c[1]) * (u - c[0]) + (c[0] - b[0]) * (v - c[1])) / area;
            const wb =
              ((c[1] - a[1]) * (u - c[0]) + (a[0] - c[0]) * (v - c[1])) / area;
            const wc = 1 - wa - wb;
            if (wa < -1e-6 || wb < -1e-6 || wc < -1e-6) continue;
            const pixel = y * SKIN_SIZE + x;
            if (map.has(pixel)) continue;
            const point = new Vector3()
              .addScaledVector(vertices[0], wa)
              .addScaledVector(vertices[1], wb)
              .addScaledVector(vertices[2], wc);
            map.set(pixel, { part, layer, normal, point, center });
          }
      }
    }
  return map;
}

const geometry = { classic: surfaces("classic"), slim: surfaces("slim") };
const isArm = (part?: SkinPart) => part === "rightArm" || part === "leftArm";

/** Each pixel holds its own index, so a result shows where it came from. */
function addressed() {
  const pixels = new Uint8ClampedArray(SKIN_SIZE * SKIN_SIZE * 4);
  for (let i = 0; i < SKIN_SIZE * SKIN_SIZE; i++)
    pixels.set([i % 256, Math.floor(i / 256), 77, 255], i * 4);
  return pixels;
}
const sourceOf = (pixels: Uint8ClampedArray, i: number) =>
  pixels[i * 4] + 256 * pixels[i * 4 + 1];

function convert(
  pixels: Uint8ClampedArray,
  from: SkinVariant,
  to: SkinVariant,
) {
  const result = pixels.slice();
  const builder = new PatchBuilder(result);
  convertArms(result, builder, from, to);
  return result;
}

for (const [from, to] of [
  ["classic", "slim"],
  ["slim", "classic"],
] as const) {
  test(`${from} to ${to} keeps each arm pixel on its part, layer, face, row, and depth`, () => {
    const output = convert(addressed(), from, to);
    let moved = 0;
    for (const [index, target] of geometry[to]) {
      if (!isArm(target.part)) continue;
      const source = geometry[from].get(sourceOf(output, index));
      assert.ok(source, `${index} comes from a used pixel`);
      assert.equal(source.part, target.part);
      assert.equal(source.layer, target.layer);
      assert.ok(source.normal.equals(target.normal), "same face");
      assert.ok(Math.abs(source.point.y - target.point.y) < 1e-4, "same row");
      assert.ok(Math.abs(source.point.z - target.point.z) < 1e-4, "same depth");
      // The inner side stays at the body. Only pixels toward the outer side
      // move, by at most one column on the model.
      const dx = Math.abs(source.point.x - target.point.x);
      const unit = target.layer === "base" ? 1 : 4.5 / 4 + 0.01;
      assert.ok(dx < 1e-4 || dx <= unit * 2, `${index} moved ${dx}`);
      if (dx > 1e-4) moved++;
    }
    assert.ok(moved > 0);
  });
}

test("narrowing keeps the inner columns in place on the 3D model", () => {
  const output = convert(addressed(), "classic", "slim");
  for (const [index, target] of geometry.slim) {
    if (!isArm(target.part) || target.layer !== "base") continue;
    const source = geometry.classic.get(sourceOf(output, index))!;
    // Pixels in the inner half of a wide face keep their exact position.
    const fromBody = Math.abs(target.point.x) - 4;
    if (Math.abs(target.normal.x) < 0.5 && fromBody < 2)
      assert.ok(source.point.distanceTo(target.point) < 1e-4, `${index}`);
  }
});

test("slim to classic adds no empty stripe, and back to slim is exact", () => {
  const slim = createTemplate("slim").pixels;
  for (let i = 0; i < SKIN_SIZE * SKIN_SIZE; i++) {
    const region = regionAt("slim", i % SKIN_SIZE, Math.floor(i / SKIN_SIZE));
    if (region)
      slim.set(
        [i % 251, (i * 7) % 253, 40, region.layer === "base" ? 255 : 180],
        i * 4,
      );
  }
  const classic = convert(slim, "slim", "classic");
  for (let i = 0; i < SKIN_SIZE * SKIN_SIZE; i++) {
    const region = regionAt(
      "classic",
      i % SKIN_SIZE,
      Math.floor(i / SKIN_SIZE),
    );
    if (region && isArm(region.part))
      assert.notEqual(classic[i * 4 + 3], 0, `empty arm pixel ${i}`);
  }
  assert.deepEqual(convert(classic, "classic", "slim"), slim);
});

test("classic to slim and back loses one column per wide face only", () => {
  const original = addressed();
  const back = convert(convert(original, "classic", "slim"), "slim", "classic");
  let lost = 0;
  for (let i = 0; i < SKIN_SIZE * SKIN_SIZE; i++) {
    if (sourceOf(back, i) === i) continue;
    const region = regionAt(
      "classic",
      i % SKIN_SIZE,
      Math.floor(i / SKIN_SIZE),
    );
    assert.ok(region && isArm(region.part), `${i} is an arm pixel`);
    assert.notEqual(region.face, "left");
    assert.notEqual(region.face, "right");
    lost++;
  }
  // 2 arms × 2 layers × (12 front + 12 back + 4 top + 4 bottom) pixels.
  assert.equal(lost, 2 * 2 * 32);
});

test("conversion changes only arm pixels and clears arm pixels the new model does not use", () => {
  const original = addressed();
  const output = convert(original, "classic", "slim");
  for (let i = 0; i < SKIN_SIZE * SKIN_SIZE; i++) {
    const x = i % SKIN_SIZE;
    const y = Math.floor(i / SKIN_SIZE);
    const before = regionAt("classic", x, y);
    const after = regionAt("slim", x, y);
    const pixel = Array.from(output.subarray(i * 4, i * 4 + 4));
    if (!isArm(before?.part) && !isArm(after?.part))
      assert.deepEqual(pixel, Array.from(original.subarray(i * 4, i * 4 + 4)));
    else if (!after) assert.deepEqual(pixel, [0, 0, 0, 0]);
  }
  // A skin with no unused pixels stays clean: no stray arm column and no
  // model hint.
  const used = original.slice();
  for (let i = 0; i < SKIN_SIZE * SKIN_SIZE; i++)
    if (!regionAt("classic", i % SKIN_SIZE, Math.floor(i / SKIN_SIZE)))
      used.set([0, 0, 0, 0], i * 4);
  assert.deepEqual(checkSkin(used, "classic"), []);
  assert.deepEqual(checkSkin(convert(used, "classic", "slim"), "slim"), []);
});

test("store conversion is one undo step with the model, and undo restores every byte", () => {
  const store = new SkinEditorStore();
  store.load({ pixels: addressed(), variant: "classic" });
  const before = store.pixels.slice();
  assert.equal(store.convertVariant("slim"), true);
  assert.equal(store.getSnapshot().variant, "slim");
  assert.notDeepEqual(store.pixels, before);
  assert.equal(store.undo(), true);
  assert.equal(store.getSnapshot().variant, "classic");
  assert.deepEqual(store.pixels, before);
  assert.equal(store.getSnapshot().canUndo, false);
  store.redo();
  assert.equal(store.getSnapshot().variant, "slim");
  assert.equal(store.convertVariant("slim"), false);
  // Selecting a model still moves no pixels.
  const converted = store.pixels.slice();
  store.setVariant("classic");
  assert.deepEqual(store.pixels, converted);
});

for (const variant of ["classic", "slim"] as const) {
  test(`${variant} flip matches the reflection of each part through its own center`, () => {
    const map = geometry[variant];
    let count = 0;
    for (const [index, surface] of map) {
      const to = flipPixel(
        variant,
        index % SKIN_SIZE,
        Math.floor(index / SKIN_SIZE),
      )!;
      const target = map.get(to.y * SKIN_SIZE + to.x)!;
      assert.equal(target.part, surface.part);
      assert.equal(target.layer, surface.layer);
      const reflected = surface.point.clone();
      reflected.x = 2 * surface.center.x - reflected.x;
      assert.ok(target.point.distanceTo(reflected) < 1e-4, `${index}`);
      count++;
    }
    assert.equal(count, variant === "classic" ? 3264 : 3136);
  });

  test(`${variant} copy matches the same spot on the paired limb without reflection`, () => {
    const map = geometry[variant];
    let count = 0;
    for (const [index, surface] of map) {
      const to = pairedPixel(
        variant,
        index % SKIN_SIZE,
        Math.floor(index / SKIN_SIZE),
      );
      if (surface.part === "head" || surface.part === "body") {
        assert.equal(to, undefined);
        continue;
      }
      const target = map.get(to!.y * SKIN_SIZE + to!.x)!;
      assert.notEqual(target.part, surface.part);
      assert.equal(target.layer, surface.layer);
      assert.ok(target.normal.equals(surface.normal));
      const moved = surface.point
        .clone()
        .sub(surface.center)
        .add(target.center);
      assert.ok(target.point.distanceTo(moved) < 1e-4, `${index}`);
      count++;
    }
    assert.equal(count, variant === "classic" ? 1792 : 1664);
  });
}

function partSettings(layer: "base" | "outer" = "base") {
  return { layer, visibility: allPartsVisible() };
}

test("flip and copy change only the active layer of the target and keep alpha", () => {
  const original = addressed();
  for (let i = 0; i < SKIN_SIZE * SKIN_SIZE; i++)
    original[i * 4 + 3] = 10 + (i % 200);
  const flipped = original.slice();
  transformPart(
    flipped,
    new PatchBuilder(flipped),
    "classic",
    partSettings("outer"),
    {
      kind: "flip",
      part: "leftArm",
    },
  );
  const copied = original.slice();
  transformPart(copied, new PatchBuilder(copied), "classic", partSettings(), {
    kind: "copy",
    from: "rightLeg",
    to: "leftLeg",
  });
  for (let i = 0; i < SKIN_SIZE * SKIN_SIZE; i++) {
    const x = i % SKIN_SIZE;
    const y = Math.floor(i / SKIN_SIZE);
    const region = regionAt("classic", x, y);
    const pick = (pixels: Uint8ClampedArray) =>
      Array.from(pixels.subarray(i * 4, i * 4 + 4));
    if (region?.part === "leftArm" && region.layer === "outer") {
      const from = flipPixel("classic", x, y)!;
      const j = from.y * SKIN_SIZE + from.x;
      assert.deepEqual(
        pick(flipped),
        Array.from(original.subarray(j * 4, j * 4 + 4)),
      );
    } else assert.deepEqual(pick(flipped), pick(original), `flip changed ${i}`);
    if (region?.part === "leftLeg" && region.layer === "base") {
      const from = pairedPixel("classic", x, y)!;
      const j = from.y * SKIN_SIZE + from.x;
      assert.deepEqual(
        pick(copied),
        Array.from(original.subarray(j * 4, j * 4 + 4)),
      );
    } else assert.deepEqual(pick(copied), pick(original), `copy changed ${i}`);
  }
});

test("a hidden target never changes, a double flip restores the part, and each action is one undo step", () => {
  const store = new SkinEditorStore();
  store.load({ pixels: addressed(), variant: "slim" });
  const before = store.pixels.slice();
  const visibility = allPartsVisible();
  visibility.rightArm.base = false;
  assert.equal(
    store.transformPart(
      { layer: "base", visibility },
      { kind: "copy", from: "leftArm", to: "rightArm" },
    ),
    false,
  );
  assert.equal(
    store.transformPart(
      { layer: "base", visibility },
      { kind: "flip", part: "rightArm" },
    ),
    false,
  );
  assert.deepEqual(store.pixels, before);
  assert.equal(store.getSnapshot().canUndo, false);
  assert.equal(
    store.transformPart(partSettings(), { kind: "flip", part: "head" }),
    true,
  );
  assert.equal(
    store.transformPart(partSettings(), { kind: "flip", part: "head" }),
    true,
  );
  assert.deepEqual(store.pixels, before);
  store.undo();
  assert.notDeepEqual(store.pixels, before);
  store.undo();
  assert.deepEqual(store.pixels, before);
  assert.equal(store.getSnapshot().canUndo, false);
});
