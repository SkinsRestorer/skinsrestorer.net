import assert from "node:assert/strict";
import { test } from "node:test";
import { decodePng, encodePng, encodePngSync } from "./png";

const any = () => undefined;

test("encoded PNGs decode to the same straight RGBA bytes", async () => {
  const pixels = new Uint8ClampedArray(64 * 64 * 4);
  for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 37 + 11) % 256;
  // Color under zero alpha and partial alpha are both kept.
  pixels.set([200, 100, 50, 0], 0);
  pixels.set([13, 77, 201, 1], 4);
  const png = await encodePng(pixels, 64, 64);
  const decoded = await decodePng(png, any);
  assert.equal(decoded.width, 64);
  assert.equal(decoded.height, 64);
  assert.deepEqual(decoded.pixels, pixels);
});

test("uncompressed PNGs, including multi-block data, decode to the same bytes", async () => {
  for (const [width, height] of [
    [64, 64],
    [128, 160],
  ]) {
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 13) % 251;
    const decoded = await decodePng(encodePngSync(pixels, width, height), any);
    assert.deepEqual(decoded.pixels, pixels);
  }
});

test("the size check runs before image data is inflated", async () => {
  const png = await encodePng(new Uint8ClampedArray(128 * 128 * 4), 128, 128);
  await assert.rejects(
    decodePng(png, (w, h) => {
      throw new Error(`rejected ${w}x${h}`);
    }),
    /rejected 128x128/,
  );
});

test("damaged and non-PNG input is rejected", async () => {
  const png = await encodePng(new Uint8ClampedArray(4 * 4 * 4), 4, 4);
  const broken = png.slice();
  broken[40] ^= 0xff;
  await assert.rejects(decodePng(broken, any), /damaged/);
  await assert.rejects(decodePng(new Uint8Array([1, 2, 3]), any), /not a PNG/);
  await assert.rejects(decodePng(png.slice(0, 30), any), /incomplete/);
});

// Build other PNG color types to check the decoder against known pixels.
const table = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const b of bytes) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)));
  return out;
}
async function build(
  width: number,
  height: number,
  depth: number,
  colorType: number,
  raw: number[],
  extra: Uint8Array[] = [],
) {
  const header = new Uint8Array(13);
  new DataView(header.buffer).setUint32(0, width);
  new DataView(header.buffer).setUint32(4, height);
  header[8] = depth;
  header[9] = colorType;
  const compressed = new Uint8Array(
    await new Response(
      new Blob([new Uint8Array(raw)])
        .stream()
        .pipeThrough(new CompressionStream("deflate")),
    ).arrayBuffer(),
  );
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    ...extra,
    chunk("IDAT", compressed),
    chunk("IEND", new Uint8Array()),
  ];
  return new Uint8Array(parts.flatMap((p) => [...p]));
}

test("palette images with transparency decode to RGBA", async () => {
  const palette = chunk("PLTE", new Uint8Array([255, 0, 0, 0, 255, 0]));
  const alpha = chunk("tRNS", new Uint8Array([0]));
  // 2-bit indexes: row 0 = [1, 0], row 1 = [0, 1].
  const png = await build(
    2,
    2,
    2,
    3,
    [0, 0b01000000, 0, 0b00010000],
    [palette, alpha],
  );
  const { pixels } = await decodePng(png, any);
  assert.deepEqual(
    [...pixels],
    [0, 255, 0, 255, 255, 0, 0, 0, 255, 0, 0, 0, 0, 255, 0, 255],
  );
});

test("RGB rows with Sub, Up, Average and Paeth filters decode exactly", async () => {
  // 2×4 RGB image. Every row decodes to [10,20,30] and [40,50,60].
  const average = (left: number, up: number, value: number) =>
    value - ((left + up) >> 1);
  const raw = [
    [1, 10, 20, 30, 30, 30, 30], // Sub: second pixel adds the left pixel
    [2, 0, 0, 0, 0, 0, 0], // Up: copies the row above
    [
      3,
      average(0, 10, 10),
      average(0, 20, 20),
      average(0, 30, 30),
      average(10, 40, 40),
      average(20, 50, 50),
      average(30, 60, 60),
    ],
    [4, 0, 0, 0, 0, 0, 0], // Paeth: predicts the pixel above here
  ].flat();
  const png = await build(2, 4, 8, 2, raw);
  const { pixels } = await decodePng(png, any);
  for (let y = 0; y < 4; y++)
    assert.deepEqual(
      [...pixels.subarray(y * 8, y * 8 + 8)],
      [10, 20, 30, 255, 40, 50, 60, 255],
      `row ${y}`,
    );
});
