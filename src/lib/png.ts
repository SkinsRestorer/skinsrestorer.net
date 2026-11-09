import { MessageError } from "./messages";
/**
 * A small PNG codec for skin-sized images.
 *
 * Canvas encoding and decoding use premultiplied alpha, which changes the
 * color of partly transparent pixels and drops the color of fully transparent
 * pixels. This codec keeps straight RGBA bytes, so an exported skin reads back
 * with the same bytes.
 */

const signature = [137, 80, 78, 71, 13, 10, 26, 10];

export class PngError extends MessageError {
  override readonly name = "PngError";
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array, start = 0, end = bytes.length) {
  let crc = 0xffffffff;
  for (let i = start; i < end; i++)
    crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function transform(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
  maxBytes = Number.POSITIVE_INFINITY,
): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const written = writer
    .write(bytes as Uint8Array<ArrayBuffer>)
    .then(() => writer.close())
    .catch(() => undefined);
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new PngError("png.dataTooLarge");
      parts.push(value);
    }
  } catch (cause) {
    await reader.cancel().catch(() => undefined);
    if (cause instanceof PngError) throw cause;
    throw new PngError("png.dataDamaged");
  } finally {
    await written;
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out, 4, 8 + data.length));
  return out;
}

function scanlines(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
) {
  if (pixels.length !== width * height * 4)
    throw new PngError("png.bufferSize");
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    raw.set(
      pixels.subarray(y * stride, (y + 1) * stride),
      y * (stride + 1) + 1,
    );
  }
  return raw;
}

function assemble(width: number, height: number, data: Uint8Array) {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const parts = [
    new Uint8Array(signature),
    chunk("IHDR", header),
    chunk("IDAT", data),
    chunk("IEND", new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Encode straight (not premultiplied) 8-bit RGBA pixels as a PNG file. */
export async function encodePng(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const raw = scanlines(pixels, width, height);
  return assemble(
    width,
    height,
    await transform(raw, new CompressionStream("deflate")),
  );
}

/**
 * Encode without compression. The result is larger but needs no stream, so a
 * page can save it while it unloads.
 */
export function encodePngSync(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const raw = scanlines(pixels, width, height);
  const blocks = Math.max(1, Math.ceil(raw.length / 0xffff));
  const data = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  data[0] = 0x78; // zlib header: deflate, 32K window
  data[1] = 0x01;
  let at = 2;
  for (let i = 0; i < blocks; i++) {
    const part = raw.subarray(i * 0xffff, (i + 1) * 0xffff);
    data[at] = i === blocks - 1 ? 1 : 0; // stored block
    data[at + 1] = part.length & 0xff;
    data[at + 2] = part.length >> 8;
    data[at + 3] = ~part.length & 0xff;
    data[at + 4] = (~part.length >> 8) & 0xff;
    data.set(part, at + 5);
    at += 5 + part.length;
  }
  let a = 1;
  let b = 0;
  for (const byte of raw) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  new DataView(data.buffer).setUint32(at, ((b << 16) | a) >>> 0);
  return assemble(width, height, data);
}

export interface DecodedPng {
  readonly width: number;
  readonly height: number;
  /** Straight RGBA, 8 bits for each channel. */
  readonly pixels: Uint8ClampedArray;
}

const channels: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const allowedDepths: Record<number, number[]> = {
  0: [1, 2, 4, 8, 16],
  2: [8, 16],
  3: [1, 2, 4, 8],
  4: [8, 16],
  6: [8, 16],
};

const adam7 = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
] as const;

function paeth(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Remove the per-row filters in place and return each row's offset. */
function unfilter(
  data: Uint8Array,
  offset: number,
  width: number,
  height: number,
  bitsPerPixel: number,
) {
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const bpp = Math.max(1, bitsPerPixel >> 3);
  const rows: number[] = [];
  let previous = -1;
  for (let y = 0; y < height; y++) {
    const filter = data[offset];
    const row = offset + 1;
    if (row + stride > data.length) throw new PngError("png.dataIncomplete");
    for (let i = 0; i < stride; i++) {
      const left = i >= bpp ? data[row + i - bpp] : 0;
      const up = previous >= 0 ? data[previous + i] : 0;
      const upLeft = previous >= 0 && i >= bpp ? data[previous + i - bpp] : 0;
      let value = data[row + i];
      switch (filter) {
        case 0:
          break;
        case 1:
          value += left;
          break;
        case 2:
          value += up;
          break;
        case 3:
          value += (left + up) >> 1;
          break;
        case 4:
          value += paeth(left, up, upLeft);
          break;
        default:
          throw new PngError("png.rowFilter");
      }
      data[row + i] = value & 0xff;
    }
    rows.push(row);
    previous = row;
    offset = row + stride;
  }
  return { rows, end: offset };
}

/** Read the image size from the PNG header without inflating image data. */
export function readPngSize(bytes: Uint8Array) {
  if (
    bytes.length < 33 ||
    signature.some((value, i) => bytes[i] !== value) ||
    String.fromCharCode(...bytes.subarray(12, 16)) !== "IHDR"
  )
    throw new PngError("png.notPng");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/**
 * Decode a PNG file. The caller sets the allowed image sizes, so a large or
 * hostile file is rejected before its image data is inflated.
 */
export async function decodePng(
  bytes: Uint8Array,
  accept: (width: number, height: number) => void,
): Promise<DecodedPng> {
  if (
    bytes.length < signature.length ||
    signature.some((value, i) => bytes[i] !== value)
  )
    throw new PngError("png.notPng");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = signature.length;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = -1;
  let interlace = 0;
  let palette: Uint8Array | undefined;
  let transparency: Uint8Array | undefined;
  const data: Uint8Array[] = [];
  let ended = false;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > bytes.length) throw new PngError("png.fileIncomplete");
    if (view.getUint32(end) !== crc32(bytes, offset + 4, end))
      throw new PngError("png.fileDamaged");
    const body = bytes.subarray(start, end);
    if (type === "IHDR") {
      if (length !== 13) throw new PngError("png.headerInvalid");
      width = view.getUint32(start);
      height = view.getUint32(start + 4);
      depth = body[8];
      colorType = body[9];
      interlace = body[12];
      if (
        !(colorType in channels) ||
        !allowedDepths[colorType].includes(depth) ||
        body[10] !== 0 ||
        body[11] !== 0 ||
        interlace > 1
      )
        throw new PngError("png.headerInvalid");
      accept(width, height);
    } else if (type === "PLTE") palette = body;
    else if (type === "tRNS") transparency = body;
    else if (type === "IDAT") data.push(body);
    else if (type === "IEND") {
      ended = true;
      break;
    }
    offset = end + 4;
  }
  if (colorType < 0 || !ended || data.length === 0)
    throw new PngError("png.fileIncomplete");
  if (colorType === 3 && !palette) throw new PngError("png.paletteMissing");

  const bitsPerPixel = channels[colorType] * depth;
  const passes =
    interlace === 1
      ? adam7.map(([x0, y0, dx, dy]) => ({
          x0,
          y0,
          dx,
          dy,
          width: Math.ceil((width - x0) / dx),
          height: Math.ceil((height - y0) / dy),
        }))
      : [{ x0: 0, y0: 0, dx: 1, dy: 1, width, height }];
  const expected = passes.reduce(
    (n, pass) =>
      pass.width && pass.height
        ? n + pass.height * (1 + Math.ceil((pass.width * bitsPerPixel) / 8))
        : n,
    0,
  );
  const joined = new Uint8Array(data.reduce((n, part) => n + part.length, 0));
  data.reduce((at, part) => {
    joined.set(part, at);
    return at + part.length;
  }, 0);
  const raw = await transform(
    joined,
    new DecompressionStream("deflate"),
    expected,
  );

  const pixels = new Uint8ClampedArray(width * height * 4);
  const max = (1 << depth) - 1;
  const sample = (row: number, index: number) => {
    if (depth === 8) return raw[row + index];
    if (depth === 16) return raw[row + index * 2];
    const bit = index * depth;
    return (raw[row + (bit >> 3)] >> (8 - depth - (bit & 7))) & max;
  };
  const sample16 = (row: number, index: number) =>
    (raw[row + index * 2] << 8) | raw[row + index * 2 + 1];
  const scale = (value: number) =>
    depth === 16
      ? value
      : depth === 8
        ? value
        : Math.round((value * 255) / max);
  const transparentGray =
    transparency && colorType === 0 && transparency.length >= 2
      ? (transparency[0] << 8) | transparency[1]
      : undefined;
  const transparentRgb =
    transparency && colorType === 2 && transparency.length >= 6
      ? [
          (transparency[0] << 8) | transparency[1],
          (transparency[2] << 8) | transparency[3],
          (transparency[4] << 8) | transparency[5],
        ]
      : undefined;

  let offsetInRaw = 0;
  for (const pass of passes) {
    if (!pass.width || !pass.height) continue;
    const { rows, end } = unfilter(
      raw,
      offsetInRaw,
      pass.width,
      pass.height,
      bitsPerPixel,
    );
    offsetInRaw = end;
    for (let py = 0; py < pass.height; py++) {
      const row = rows[py];
      for (let px = 0; px < pass.width; px++) {
        const x = pass.x0 + px * pass.dx;
        const y = pass.y0 + py * pass.dy;
        const out = (y * width + x) * 4;
        const c = channels[colorType];
        let r: number;
        let g: number;
        let b: number;
        let a = 255;
        if (colorType === 3) {
          const index = sample(row, px);
          if (index * 3 + 2 >= palette!.length)
            throw new PngError("png.paletteTooShort");
          r = palette![index * 3];
          g = palette![index * 3 + 1];
          b = palette![index * 3 + 2];
          if (transparency && index < transparency.length)
            a = transparency[index];
        } else if (colorType === 0 || colorType === 4) {
          const raw16 = depth === 16 ? sample16(row, px * c) : -1;
          const gray = scale(sample(row, px * c));
          r = g = b = gray;
          if (colorType === 4) a = sample(row, px * c + 1);
          else if (
            transparentGray !== undefined &&
            (depth === 16 ? raw16 : sample(row, px)) === transparentGray
          )
            a = 0;
        } else {
          r = sample(row, px * c);
          g = sample(row, px * c + 1);
          b = sample(row, px * c + 2);
          if (colorType === 6) a = sample(row, px * c + 3);
          else if (transparentRgb) {
            const value =
              depth === 16
                ? [
                    sample16(row, px * 3),
                    sample16(row, px * 3 + 1),
                    sample16(row, px * 3 + 2),
                  ]
                : [r, g, b];
            if (value.every((v, i) => v === transparentRgb[i])) a = 0;
          }
        }
        pixels[out] = r;
        pixels[out + 1] = g;
        pixels[out + 2] = b;
        pixels[out + 3] = a;
      }
    }
  }
  return { width, height, pixels };
}
