import { createTranslator } from "./messages";
import type { MessageKey } from "@/lib/messages";
import type { SkinVariant } from "./skin";

export const SKIN_SIZE = 64;

export type SkinLayer = "base" | "outer";
export type SkinPart =
  | "head"
  | "body"
  | "rightArm"
  | "leftArm"
  | "rightLeg"
  | "leftLeg";
export type SkinFace = "top" | "bottom" | "right" | "front" | "left" | "back";

export interface SkinRegion {
  readonly part: SkinPart;
  readonly layer: SkinLayer;
  readonly face: SkinFace;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const skinParts: readonly SkinPart[] = [
  "head",
  "body",
  "rightArm",
  "leftArm",
  "rightLeg",
  "leftLeg",
];

export const skinPartLabels: Record<SkinPart, MessageKey> = {
  head: "editor.head",
  body: "editor.body",
  rightArm: "editor.rightArm",
  leftArm: "editor.leftArm",
  rightLeg: "editor.rightLeg",
  leftLeg: "editor.leftLeg",
};

export const skinFaceLabels: Record<SkinFace, MessageKey> = {
  top: "editor.face.top",
  bottom: "editor.face.bottom",
  right: "editor.face.right",
  front: "editor.face.front",
  left: "editor.face.left",
  back: "editor.face.back",
};

/** Texture origin of each box in the Java Edition 64×64 layout. */
const boxes: Record<
  SkinPart,
  Record<SkinLayer, { u: number; v: number }> & {
    width: number | ((variant: SkinVariant) => number);
    height: number;
    depth: number;
  }
> = {
  head: {
    base: { u: 0, v: 0 },
    outer: { u: 32, v: 0 },
    width: 8,
    height: 8,
    depth: 8,
  },
  body: {
    base: { u: 16, v: 16 },
    outer: { u: 16, v: 32 },
    width: 8,
    height: 12,
    depth: 4,
  },
  rightArm: {
    base: { u: 40, v: 16 },
    outer: { u: 40, v: 32 },
    width: (variant) => (variant === "slim" ? 3 : 4),
    height: 12,
    depth: 4,
  },
  leftArm: {
    base: { u: 32, v: 48 },
    outer: { u: 48, v: 48 },
    width: (variant) => (variant === "slim" ? 3 : 4),
    height: 12,
    depth: 4,
  },
  rightLeg: {
    base: { u: 0, v: 16 },
    outer: { u: 0, v: 32 },
    width: 4,
    height: 12,
    depth: 4,
  },
  leftLeg: {
    base: { u: 16, v: 48 },
    outer: { u: 0, v: 48 },
    width: 4,
    height: 12,
    depth: 4,
  },
};

function boxFaces(
  part: SkinPart,
  layer: SkinLayer,
  variant: SkinVariant,
): SkinRegion[] {
  const box = boxes[part];
  const { u, v } = box[layer];
  const w = typeof box.width === "number" ? box.width : box.width(variant);
  const h = box.height;
  const d = box.depth;
  const face = (
    face: SkinFace,
    x: number,
    y: number,
    width: number,
    height: number,
  ): SkinRegion => ({ part, layer, face, x, y, width, height });
  return [
    face("top", u + d, v, w, d),
    face("bottom", u + d + w, v, w, d),
    face("right", u, v + d, d, h),
    face("front", u + d, v + d, w, h),
    face("left", u + d + w, v + d, d, h),
    face("back", u + d * 2 + w, v + d, w, h),
  ];
}

const regionCache = new Map<SkinVariant, readonly SkinRegion[]>();
const indexCache = new Map<SkinVariant, Int16Array>();

/** Every face of every body part on both layers, as used by Java Edition. */
export function skinRegions(variant: SkinVariant): readonly SkinRegion[] {
  let regions = regionCache.get(variant);
  if (!regions) {
    regions = skinParts.flatMap((part) => [
      ...boxFaces(part, "base", variant),
      ...boxFaces(part, "outer", variant),
    ]);
    regionCache.set(variant, regions);
  }
  return regions;
}

function regionIndex(variant: SkinVariant): Int16Array {
  let index = indexCache.get(variant);
  if (!index) {
    index = new Int16Array(SKIN_SIZE * SKIN_SIZE).fill(-1);
    skinRegions(variant).forEach((region, id) => {
      for (let y = region.y; y < region.y + region.height; y++)
        for (let x = region.x; x < region.x + region.width; x++)
          index![y * SKIN_SIZE + x] = id;
    });
    indexCache.set(variant, index);
  }
  return index;
}

/** The face that owns a texture pixel, or undefined for an unused pixel. */
export function regionAt(
  variant: SkinVariant,
  x: number,
  y: number,
): SkinRegion | undefined {
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= SKIN_SIZE ||
    y >= SKIN_SIZE
  )
    return undefined;
  const id = regionIndex(variant)[y * SKIN_SIZE + x];
  return id < 0 ? undefined : skinRegions(variant)[id];
}

export function findRegion(
  variant: SkinVariant,
  part: SkinPart,
  layer: SkinLayer,
  face: SkinFace,
): SkinRegion {
  const region = skinRegions(variant).find(
    (r) => r.part === part && r.layer === layer && r.face === face,
  );
  if (!region) throw new Error(`Unknown region ${part} ${layer} ${face}`);
  return region;
}

const mirrorParts: Record<SkinPart, SkinPart> = {
  head: "head",
  body: "body",
  rightArm: "leftArm",
  leftArm: "rightArm",
  rightLeg: "leftLeg",
  leftLeg: "rightLeg",
};

/** The arm or leg on the other side of the body. The head and body have none. */
export const pairedParts: Partial<Record<SkinPart, SkinPart>> = {
  rightArm: "leftArm",
  leftArm: "rightArm",
  rightLeg: "leftLeg",
  leftLeg: "rightLeg",
};

type PixelMap = "mirror" | "flip" | "pair";
const mapCache = new Map<string, Int16Array>();

/**
 * Build a pixel table for one transform. "mirror" and "flip" reflect across
 * the player's left-right axis, so the left and right sides swap and every
 * face reverses its columns. "mirror" moves to the paired part, and "flip"
 * stays on the same part. "pair" moves to the paired part without
 * reflection: each face keeps its side, rows, and columns.
 */
function pixelMap(variant: SkinVariant, kind: PixelMap): Int16Array {
  const key = `${variant} ${kind}`;
  let table = mapCache.get(key);
  if (table) return table;
  table = new Int16Array(SKIN_SIZE * SKIN_SIZE).fill(-1);
  for (const region of skinRegions(variant)) {
    const part =
      kind === "flip"
        ? region.part
        : kind === "pair"
          ? pairedParts[region.part]
          : mirrorParts[region.part];
    if (!part) continue;
    const reflect = kind !== "pair";
    const face = !reflect
      ? region.face
      : region.face === "left"
        ? "right"
        : region.face === "right"
          ? "left"
          : region.face;
    const target = findRegion(variant, part, region.layer, face);
    for (let row = 0; row < region.height; row++)
      for (let column = 0; column < region.width; column++)
        table[(region.y + row) * SKIN_SIZE + region.x + column] =
          (target.y + row) * SKIN_SIZE +
          target.x +
          (reflect ? target.width - 1 - column : column);
  }
  mapCache.set(key, table);
  return table;
}

function mapPixel(variant: SkinVariant, kind: PixelMap, x: number, y: number) {
  if (!regionAt(variant, x, y)) return undefined;
  const index = pixelMap(variant, kind)[y * SKIN_SIZE + x];
  if (index < 0) return undefined;
  return { x: index % SKIN_SIZE, y: Math.floor(index / SKIN_SIZE) };
}

/**
 * The pixel on the other side of the model, mirrored across the player's
 * left-right axis. Arms and legs swap, the left and right sides swap, and
 * every face reverses its columns. Rows stay the same. The result is on the
 * same layer. Unused pixels have no mirror.
 */
export function mirrorPixel(variant: SkinVariant, x: number, y: number) {
  return mapPixel(variant, "mirror", x, y);
}

/**
 * The pixel that a left-right flip of its own part moves it to: the left and
 * right sides swap and every face reverses its columns, like a reflection in
 * a mirror. The pixel stays on the same part and layer.
 */
export function flipPixel(variant: SkinVariant, x: number, y: number) {
  return mapPixel(variant, "flip", x, y);
}

/**
 * The same face, row, and column on the paired arm or leg, without a
 * reflection. The head and body have no paired pixel.
 */
export function pairedPixel(variant: SkinVariant, x: number, y: number) {
  return mapPixel(variant, "pair", x, y);
}

export function regionContains(region: SkinRegion, x: number, y: number) {
  return (
    x >= region.x &&
    y >= region.y &&
    x < region.x + region.width &&
    y < region.y + region.height
  );
}

export function sameRegion(a: SkinRegion, b: SkinRegion) {
  return a.part === b.part && a.layer === b.layer && a.face === b.face;
}

export function describePixel(
  variant: SkinVariant,
  x: number,
  y: number,
  t: (key: MessageKey) => string = createTranslator("en"),
) {
  const region = regionAt(variant, x, y);
  const where = region
    ? `${t(skinPartLabels[region.part])} ${t(skinFaceLabels[region.face])}, ${t(region.layer === "base" ? "common.baseLayer" : "common.outerLayer")}`
    : t("editor.unusedArea");
  return `${where}, x ${x}, y ${y}`;
}
