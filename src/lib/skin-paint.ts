import type { SkinVariant } from "./skin";
import type { PatchBuilder } from "./skin-history";
import {
  mirrorPixel,
  regionAt,
  regionContains,
  sameRegion,
  SKIN_SIZE,
  skinParts,
  type SkinLayer,
  type SkinPart,
  type SkinRegion,
} from "./skin-regions";

export type PaintTool = "pencil" | "eraser" | "shade" | "eyedropper" | "fill";
/** Tools that paint a stroke from pointer down to pointer up. */
export type StrokeTool = "pencil" | "eraser" | "shade";
export type ShadeMode = "lighten" | "darken";
export type Rgba = readonly [number, number, number, number];
export type PartVisibility = Record<SkinPart, Record<SkinLayer, boolean>>;

export interface PaintSettings {
  readonly layer: SkinLayer;
  readonly color: Rgba;
  readonly visibility: PartVisibility;
  /** Width of the square brush in pixels, for the pencil, eraser, and shade. */
  readonly size: number;
  /** Also paint the mirrored pixels on the other side of the model. */
  readonly mirror: boolean;
  readonly shade: ShadeMode;
}

export const BRUSH_SIZES = { min: 1, max: 8 } as const;

export const defaultBrush: Pick<PaintSettings, "size" | "mirror" | "shade"> = {
  size: 1,
  mirror: false,
  shade: "darken",
};

export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function allPartsVisible(): PartVisibility {
  return Object.fromEntries(
    skinParts.map((part) => [part, { base: true, outer: true }]),
  ) as PartVisibility;
}

/** The face a tool may write to, or undefined if the pixel is off limits. */
export function paintableRegion(
  variant: SkinVariant,
  settings: Pick<PaintSettings, "layer" | "visibility">,
  x: number,
  y: number,
): SkinRegion | undefined {
  const region = regionAt(variant, x, y);
  if (!region || region.layer !== settings.layer) return undefined;
  if (!settings.visibility[region.part][region.layer]) return undefined;
  return region;
}

/**
 * The RGBA a tool writes. Java Edition shows the base layer fully opaque, so
 * the pencil writes alpha 255 there and the eraser does nothing.
 */
export function toolColor(
  tool: "pencil" | "eraser",
  layer: SkinLayer,
  color: Rgba,
): Rgba | undefined {
  if (tool === "eraser") return layer === "outer" ? [0, 0, 0, 0] : undefined;
  return layer === "base" ? [color[0], color[1], color[2], 255] : color;
}

/**
 * The square brush at a pixel. An odd size is centered on the pixel. An even
 * size has no center pixel, so it reaches one pixel further up and left.
 */
export function brushSquare(x: number, y: number, size: number): PixelRect {
  const width = Math.max(
    BRUSH_SIZES.min,
    Math.min(BRUSH_SIZES.max, Math.round(size)),
  );
  const before = Math.floor(width / 2);
  return { x: x - before, y: y - before, width, height: width };
}

function intersect(a: PixelRect, b: PixelRect): PixelRect | undefined {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const width = Math.min(a.x + a.width, b.x + b.width) - x;
  const height = Math.min(a.y + a.height, b.y + b.height) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : undefined;
}

/**
 * The rectangles a brush covers at a pixel: the square clipped to the face
 * under the pixel, and its mirror image when mirror is on and that part is
 * visible. A surface lock limits the brush to one face.
 */
export function brushArea(
  variant: SkinVariant,
  settings: Pick<PaintSettings, "layer" | "visibility" | "size" | "mirror">,
  x: number,
  y: number,
  lock?: SkinRegion,
): { source: PixelRect; mirror?: PixelRect } | undefined {
  const region = paintableRegion(variant, settings, x, y);
  if (!region || (lock && !sameRegion(region, lock))) return undefined;
  const source = intersect(brushSquare(x, y, settings.size), region);
  if (!source) return undefined;
  if (!settings.mirror) return { source };
  const a = mirrorPixel(variant, source.x, source.y);
  const b = mirrorPixel(
    variant,
    source.x + source.width - 1,
    source.y + source.height - 1,
  );
  if (!a || !b || !paintableRegion(variant, settings, a.x, a.y))
    return { source };
  const mirror = {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: source.width,
    height: source.height,
  };
  return { source, mirror };
}

/**
 * Pixel indexes the brush changes at a pixel, each one once, also where the
 * square and its mirror image overlap.
 */
export function brushPixels(
  variant: SkinVariant,
  settings: Pick<PaintSettings, "layer" | "visibility" | "size" | "mirror">,
  x: number,
  y: number,
  lock?: SkinRegion,
): number[] {
  const area = brushArea(variant, settings, x, y, lock);
  if (!area) return [];
  const pixels = new Set<number>();
  for (const rect of [area.source, area.mirror])
    if (rect)
      for (let py = rect.y; py < rect.y + rect.height; py++)
        for (let px = rect.x; px < rect.x + rect.width; px++)
          pixels.add(py * SKIN_SIZE + px);
  return [...pixels];
}

/** The change in HSL lightness for one shade of a pixel. */
export const SHADE_STEP = 0.08;

/**
 * Make one pixel lighter or darker. The hue, saturation, and alpha stay the
 * same, and the lightness stops at black or white. A clear pixel has no color
 * to shade, so it returns undefined.
 */
export function shadeColor(color: Rgba, mode: ShadeMode): Rgba | undefined {
  if (color[3] === 0) return undefined;
  const r = color[0] / 255;
  const g = color[1] / 255;
  const b = color[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const chroma = max - min;
  let hue = 0;
  let saturation = 0;
  if (chroma > 0) {
    saturation = chroma / (1 - Math.abs(2 * lightness - 1));
    if (max === r) hue = ((g - b) / chroma + 6) % 6;
    else if (max === g) hue = (b - r) / chroma + 2;
    else hue = (r - g) / chroma + 4;
  }
  const next = Math.min(
    1,
    Math.max(0, lightness + (mode === "lighten" ? SHADE_STEP : -SHADE_STEP)),
  );
  const c = (1 - Math.abs(2 * next - 1)) * saturation;
  const x = c * (1 - Math.abs((hue % 2) - 1));
  const m = next - c / 2;
  const [r1, g1, b1] =
    hue < 1
      ? [c, x, 0]
      : hue < 2
        ? [x, c, 0]
        : hue < 3
          ? [0, c, x]
          : hue < 4
            ? [0, x, c]
            : hue < 5
              ? [x, 0, c]
              : [c, 0, x];
  const channel = (value: number) =>
    Math.min(255, Math.max(0, Math.round((value + m) * 255)));
  return [channel(r1), channel(g1), channel(b1), color[3]];
}

/** Integer points from start to end, inclusive, with no gaps (Bresenham). */
export function linePoints(x0: number, y0: number, x1: number, y1: number) {
  const points: Array<readonly [number, number]> = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  let x = x0;
  let y = y0;
  while (true) {
    points.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * error;
    if (e2 >= dy) {
      error += dy;
      x += sx;
    }
    if (e2 <= dx) {
      error += dx;
      y += sy;
    }
  }
  return points;
}

export function readPixel(
  pixels: Uint8ClampedArray,
  x: number,
  y: number,
): Rgba {
  const at = (y * SKIN_SIZE + x) * 4;
  return [pixels[at], pixels[at + 1], pixels[at + 2], pixels[at + 3]];
}

/**
 * Replace the connected area of matching pixels, staying inside the face that
 * was clicked so the fill never runs into a neighbouring UV island. With
 * mirror on, the same shape is also filled on the other side of the model.
 */
export function fillFace(
  pixels: Uint8ClampedArray,
  builder: PatchBuilder,
  variant: SkinVariant,
  settings: PaintSettings,
  x: number,
  y: number,
) {
  const region = paintableRegion(variant, settings, x, y);
  const color = toolColor("pencil", settings.layer, settings.color);
  if (!region || !color) return;
  const target = readPixel(pixels, x, y);
  const same = (px: number, py: number) => {
    const at = (py * SKIN_SIZE + px) * 4;
    return (
      pixels[at] === target[0] &&
      pixels[at + 1] === target[1] &&
      pixels[at + 2] === target[2] &&
      pixels[at + 3] === target[3]
    );
  };
  // Find the whole area first, so the mirror copy cannot change it.
  const area = new Set<number>();
  const stack: Array<readonly [number, number]> = [[x, y]];
  while (stack.length > 0) {
    const [px, py] = stack.pop()!;
    const index = py * SKIN_SIZE + px;
    if (area.has(index) || !regionContains(region, px, py) || !same(px, py))
      continue;
    area.add(index);
    stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
  }
  const targets = new Set(area);
  if (settings.mirror)
    for (const index of area) {
      const mirror = mirrorPixel(
        variant,
        index % SKIN_SIZE,
        Math.floor(index / SKIN_SIZE),
      );
      if (mirror && paintableRegion(variant, settings, mirror.x, mirror.y))
        targets.add(mirror.y * SKIN_SIZE + mirror.x);
    }
  for (const index of targets) builder.write(index, color);
}
