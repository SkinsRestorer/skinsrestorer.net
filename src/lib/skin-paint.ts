import type { SkinVariant } from "./skin";
import type { PatchBuilder } from "./skin-history";
import {
  regionAt,
  regionContains,
  SKIN_SIZE,
  skinParts,
  type SkinLayer,
  type SkinPart,
  type SkinRegion,
} from "./skin-regions";

export type PaintTool = "pencil" | "eraser" | "eyedropper" | "fill";
export type Rgba = readonly [number, number, number, number];
export type PartVisibility = Record<SkinPart, Record<SkinLayer, boolean>>;

export interface PaintSettings {
  readonly layer: SkinLayer;
  readonly color: Rgba;
  readonly visibility: PartVisibility;
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
 * was clicked so the fill never runs into a neighbouring UV island.
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
  if (target.every((value, i) => value === color[i])) return;
  const seen = new Set<number>();
  const stack: Array<readonly [number, number]> = [[x, y]];
  while (stack.length > 0) {
    const [px, py] = stack.pop()!;
    const index = py * SKIN_SIZE + px;
    if (seen.has(index) || !regionContains(region, px, py) || !same(px, py))
      continue;
    seen.add(index);
    builder.write(index, color);
    stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
  }
}
