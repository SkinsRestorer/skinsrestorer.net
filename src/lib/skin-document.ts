import { MessageError } from "./messages";
import type { SkinVariant } from "./skin";
import { decodePng, encodePng, PngError } from "./png";
import { findRegion, SKIN_SIZE, skinRegions } from "./skin-regions";

/** The editor source of truth: straight RGBA pixels and an explicit model. */
export interface SkinDocument {
  readonly pixels: Uint8ClampedArray;
  readonly variant: SkinVariant;
}

export const SKIN_BYTES = SKIN_SIZE * SKIN_SIZE * 4;
export const MAX_SKIN_FILE_BYTES = 5 * 1024 * 1024;

export class SkinFileError extends MessageError {
  override readonly name = "SkinFileError";
}

export function emptyPixels() {
  return new Uint8ClampedArray(SKIN_BYTES);
}

export function pixelOffset(x: number, y: number) {
  return (y * SKIN_SIZE + x) * 4;
}

/**
 * Convert a 64×32 skin to the 64×64 layout. The left arm and left leg copy the
 * right limbs with each face mirrored, as Java Edition does for legacy skins.
 *
 * The mapping follows skinview-utils `convertSkinTo1_8` (MIT, bs-community).
 */
export function convertLegacySkin(legacy: Uint8ClampedArray) {
  if (legacy.length !== SKIN_SIZE * 32 * 4)
    throw new SkinFileError("errors.legacyDimensions");
  const pixels = emptyPixels();
  pixels.set(legacy);
  const copyMirrored = (
    sx: number,
    sy: number,
    w: number,
    h: number,
    dx: number,
    dy: number,
  ) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const from = pixelOffset(sx + w - 1 - x, sy + y);
        const to = pixelOffset(dx + x, dy + y);
        pixels.copyWithin(to, from, from + 4);
      }
  };
  copyMirrored(4, 16, 4, 4, 20, 48); // leg top
  copyMirrored(8, 16, 4, 4, 24, 48); // leg bottom
  copyMirrored(0, 20, 4, 12, 24, 52); // leg outside
  copyMirrored(4, 20, 4, 12, 20, 52); // leg front
  copyMirrored(8, 20, 4, 12, 16, 52); // leg inside
  copyMirrored(12, 20, 4, 12, 28, 52); // leg back
  copyMirrored(44, 16, 4, 4, 36, 48); // arm top
  copyMirrored(48, 16, 4, 4, 40, 48); // arm bottom
  copyMirrored(40, 20, 4, 12, 40, 52); // arm outside
  copyMirrored(44, 20, 4, 12, 36, 52); // arm front
  copyMirrored(48, 20, 4, 12, 32, 52); // arm inside
  copyMirrored(52, 20, 4, 12, 44, 52); // arm back
  return pixels;
}

/**
 * Guess the arm width. Slim skins leave the fourth arm column empty. This is a
 * heuristic and the user always confirms the model.
 */
export function detectVariantFromPixels(pixels: Uint8ClampedArray) {
  for (let y = 0; y < 12; y++) {
    if (
      pixels[pixelOffset(46, 52 + y) + 3] === 255 ||
      pixels[pixelOffset(54, 20 + y) + 3] === 255
    )
      return "classic" as const;
  }
  return "slim" as const;
}

export interface ImportedSkin {
  readonly document: SkinDocument;
  readonly legacy: boolean;
}

export function validateEditorSkinSize(width: number, height: number) {
  if (width === SKIN_SIZE && (height === SKIN_SIZE || height === 32)) return;
  throw new SkinFileError("errors.editorDimensions", { width, height });
}

/** Decode a PNG file into an editor document without changing any pixel. */
export async function importSkinPng(bytes: Uint8Array): Promise<ImportedSkin> {
  if (bytes.byteLength > MAX_SKIN_FILE_BYTES)
    throw new SkinFileError("common.fileLargerThan5Mb");
  let decoded;
  try {
    decoded = await decodePng(bytes, validateEditorSkinSize);
  } catch (cause) {
    if (cause instanceof SkinFileError) throw cause;
    if (cause instanceof PngError)
      throw new SkinFileError(cause.messageKey, cause.messageValues);
    throw new SkinFileError("errors.pngCouldNotRead");
  }
  const legacy = decoded.height === 32;
  const pixels = legacy ? convertLegacySkin(decoded.pixels) : decoded.pixels;
  return {
    document: { pixels, variant: detectVariantFromPixels(pixels) },
    legacy,
  };
}

export function exportSkinPng(pixels: Uint8ClampedArray) {
  return encodePng(pixels, SKIN_SIZE, SKIN_SIZE);
}

const templateColors = {
  skin: [214, 176, 148],
  skinShade: [193, 154, 127],
  hair: [86, 62, 46],
  eyeWhite: [240, 240, 240],
  eye: [52, 72, 120],
  mouth: [150, 102, 84],
  shirt: [76, 118, 160],
  shirtShade: [62, 98, 136],
  pants: [64, 66, 92],
  shoes: [44, 44, 48],
} as const;

/**
 * A plain starter figure made in code. It does not copy any Mojang default
 * skin. The outer layer stays empty.
 */
export function createTemplate(variant: SkinVariant): SkinDocument {
  const pixels = emptyPixels();
  const set = (x: number, y: number, rgb: readonly number[]) => {
    const at = pixelOffset(x, y);
    pixels[at] = rgb[0];
    pixels[at + 1] = rgb[1];
    pixels[at + 2] = rgb[2];
    pixels[at + 3] = 255;
  };
  for (const region of skinRegions(variant)) {
    if (region.layer !== "base") continue;
    for (let y = 0; y < region.height; y++)
      for (let x = 0; x < region.width; x++) {
        let color: readonly number[];
        const shade = region.face === "bottom" || region.face === "back";
        if (region.part === "head")
          color =
            region.face === "top" || (y < 2 && region.face !== "bottom")
              ? templateColors.hair
              : region.face === "back"
                ? templateColors.hair
                : templateColors.skin;
        else if (region.part === "body")
          color = shade ? templateColors.shirtShade : templateColors.shirt;
        else if (region.part === "rightArm" || region.part === "leftArm")
          color =
            region.face === "top" || (region.face !== "bottom" && y < 4)
              ? templateColors.shirt
              : shade
                ? templateColors.skinShade
                : templateColors.skin;
        else
          color =
            region.face === "bottom" ||
            (region.face !== "top" && y >= region.height - 2)
              ? templateColors.shoes
              : templateColors.pants;
        set(region.x + x, region.y + y, color);
      }
  }
  const face = findRegion(variant, "head", "base", "front");
  set(face.x + 1, face.y + 4, templateColors.eyeWhite);
  set(face.x + 2, face.y + 4, templateColors.eye);
  set(face.x + 5, face.y + 4, templateColors.eye);
  set(face.x + 6, face.y + 4, templateColors.eyeWhite);
  set(face.x + 3, face.y + 6, templateColors.mouth);
  set(face.x + 4, face.y + 6, templateColors.mouth);
  return { pixels, variant };
}
