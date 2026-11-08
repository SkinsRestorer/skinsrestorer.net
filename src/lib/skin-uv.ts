import type { SkinVariant } from "./skin";
import {
  findRegion,
  SKIN_SIZE,
  type SkinFace,
  type SkinLayer,
  type SkinPart,
} from "./skin-regions";

/**
 * three.js BoxGeometry groups its faces as +x, -x, +y, -y, +z, -z. skinview3d
 * turns the player toward +z, so +x is the player's left side.
 */
export const boxSideFaces: readonly SkinFace[] = [
  "left",
  "right",
  "top",
  "bottom",
  "front",
  "back",
];

/**
 * Convert a ray hit on a skin box to a texture pixel. A box side has two
 * triangles, so the triangle index gives the side. The side keeps the pixel
 * inside its face, also when the hit is exactly on an edge.
 */
export function hitToPixel(
  variant: SkinVariant,
  part: SkinPart,
  layer: SkinLayer,
  faceIndex: number,
  uv: { readonly x: number; readonly y: number },
) {
  const face = boxSideFaces[Math.floor(faceIndex / 2)];
  if (!face) return undefined;
  const region = findRegion(variant, part, layer, face);
  const clamp = (value: number, min: number, size: number) =>
    Math.min(min + size - 1, Math.max(min, value));
  return {
    x: clamp(Math.floor(uv.x * SKIN_SIZE), region.x, region.width),
    y: clamp(Math.floor((1 - uv.y) * SKIN_SIZE), region.y, region.height),
    region,
  };
}
