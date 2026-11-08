import assert from "node:assert/strict";
import { test } from "node:test";
import { encodePng } from "./png";
import { checkSkin } from "./skin-check";
import {
  convertLegacySkin,
  createTemplate,
  detectVariantFromPixels,
  exportSkinPng,
  importSkinPng,
  pixelOffset,
} from "./skin-document";
import { regionAt } from "./skin-regions";

function legacyFixture() {
  const pixels = new Uint8ClampedArray(64 * 32 * 4);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 64; x++)
      pixels.set([x * 4, y * 8, 99, 255], (y * 64 + x) * 4);
  return pixels;
}

test("legacy skins copy the right limbs to the left limbs, mirrored per face", () => {
  const legacy = legacyFixture();
  const pixels = convertLegacySkin(legacy);
  // The top half stays the same.
  assert.deepEqual(pixels.subarray(0, legacy.length), legacy);
  const at = (x: number, y: number) =>
    Array.from(pixels.subarray(pixelOffset(x, y), pixelOffset(x, y) + 4));
  const legacyAt = (x: number, y: number) =>
    Array.from(legacy.subarray((y * 64 + x) * 4, (y * 64 + x) * 4 + 4));
  // Right leg front (4..7, 20..31) mirrors into left leg front (20..23, 52..63).
  assert.deepEqual(at(20, 52), legacyAt(7, 20));
  assert.deepEqual(at(23, 63), legacyAt(4, 31));
  // Right leg outside (0..3) becomes the left leg outside (24..27).
  assert.deepEqual(at(24, 52), legacyAt(3, 20));
  // Right arm front (44..47, 20..31) mirrors into left arm front (36..39, 52..63).
  assert.deepEqual(at(36, 52), legacyAt(47, 20));
  // Every base pixel of both left limbs is filled; outer areas stay empty.
  for (let y = 48; y < 64; y++)
    for (let x = 16; x < 48; x++) {
      const region = regionAt("classic", x, y);
      if (region?.layer === "base")
        assert.equal(pixels[pixelOffset(x, y) + 3], 255, `${x},${y}`);
    }
  assert.equal(pixels[pixelOffset(4, 40) + 3], 0);
});

test("a 64×32 PNG opens as a converted 64×64 skin and exports as 64×64", async () => {
  const imported = await importSkinPng(
    await encodePng(legacyFixture(), 64, 32),
  );
  assert.equal(imported.legacy, true);
  assert.equal(imported.document.pixels.length, 64 * 64 * 4);
  assert.equal(imported.document.variant, "classic");
  const reopened = await importSkinPng(
    await exportSkinPng(imported.document.pixels),
  );
  assert.equal(reopened.legacy, false);
  assert.deepEqual(reopened.document.pixels, imported.document.pixels);
});

test("imports keep every pixel, also see-through base pixels", async () => {
  const pixels = createTemplate("classic").pixels;
  pixels.set([1, 2, 3, 0], pixelOffset(10, 10));
  pixels.set([9, 8, 7, 128], pixelOffset(40, 10));
  const imported = await importSkinPng(await encodePng(pixels, 64, 64));
  assert.deepEqual(imported.document.pixels, pixels);
});

test("other image sizes are rejected with a reason", async () => {
  await assert.rejects(
    importSkinPng(
      await encodePng(new Uint8ClampedArray(128 * 128 * 4), 128, 128),
    ),
    /128×128.*Resize HD skins/,
  );
  await assert.rejects(importSkinPng(new Uint8Array(6 * 1024 * 1024)), /5 MB/);
});

test("templates are valid skins of the chosen model with an empty outer layer", () => {
  for (const variant of ["classic", "slim"] as const) {
    const { pixels } = createTemplate(variant);
    assert.equal(detectVariantFromPixels(pixels), variant);
    assert.deepEqual(checkSkin(pixels, variant), []);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++)
        if (regionAt(variant, x, y)?.layer === "outer")
          assert.equal(pixels[pixelOffset(x, y) + 3], 0);
  }
});
