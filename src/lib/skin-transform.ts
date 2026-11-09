import type { SkinVariant } from "./skin";
import type { PatchBuilder } from "./skin-history";
import type { PartVisibility } from "./skin-paint";
import {
  findRegion,
  flipPixel,
  pairedParts,
  pairedPixel,
  SKIN_SIZE,
  skinRegions,
  type SkinFace,
  type SkinLayer,
  type SkinPart,
} from "./skin-regions";

const arms = ["rightArm", "leftArm"] as const;
const layers: readonly SkinLayer[] = ["base", "outer"];
const faces: readonly SkinFace[] = [
  "top",
  "bottom",
  "right",
  "front",
  "left",
  "back",
];

/**
 * True when column 0 of an arm face is on the outer side of the arm, away
 * from the body. The top, bottom, and front faces run from the player's right
 * to the player's left. The back face runs the other way.
 */
function outerAtStart(part: (typeof arms)[number], face: SkinFace) {
  return (part === "rightArm") === (face !== "back");
}

/**
 * Source column for each target column of a face, counted from the outer
 * side of the arm. The two columns nearest the body stay where they are on
 * the model.
 *
 * - Classic to slim keeps the outer edge column, drops the column next to it,
 *   and keeps the two inner columns: 0, 2, 3.
 * - Slim to classic copies the middle column into the new column, so no empty
 *   stripe appears: 0, 1, 1, 2.
 */
const columnSources: Record<SkinVariant, readonly number[]> = {
  slim: [0, 2, 3],
  classic: [0, 1, 1, 2],
};

/**
 * Convert the arm texture between the classic and slim models. Both arms,
 * both layers, and every face change. Faces as wide as the arm (top, bottom,
 * front, back) lose or gain one column. The side faces keep every pixel and
 * only move. Arm pixels that the target model does not use become clear.
 * Every other pixel stays the same, and RGBA values are copied unchanged.
 *
 * Classic to slim loses one column of each wide face, so converting back
 * does not restore it. Slim to classic and back gives the original pixels.
 */
export function convertArms(
  pixels: Uint8ClampedArray,
  builder: PatchBuilder,
  from: SkinVariant,
  to: SkinVariant,
) {
  if (from === to) return;
  const source = pixels.slice();
  const written = new Set<number>();
  const cleared: number[] = [];
  for (const part of arms)
    for (const layer of layers)
      for (const face of faces) {
        const before = findRegion(from, part, layer, face);
        const after = findRegion(to, part, layer, face);
        const outer = outerAtStart(part, face);
        for (let row = 0; row < after.height; row++)
          for (let column = 0; column < after.width; column++) {
            let sourceColumn = column;
            if (before.width !== after.width) {
              const fromOuter = outer ? column : after.width - 1 - column;
              const sourceFromOuter = columnSources[to][fromOuter];
              sourceColumn = outer
                ? sourceFromOuter
                : before.width - 1 - sourceFromOuter;
            }
            const read =
              ((before.y + row) * SKIN_SIZE + before.x + sourceColumn) * 4;
            const index = (after.y + row) * SKIN_SIZE + after.x + column;
            written.add(index);
            builder.write(index, source.subarray(read, read + 4));
          }
        for (let y = before.y; y < before.y + before.height; y++)
          for (let x = before.x; x < before.x + before.width; x++)
            cleared.push(y * SKIN_SIZE + x);
      }
  for (const index of cleared)
    if (!written.has(index)) builder.write(index, [0, 0, 0, 0]);
}

export type PartAction =
  | { readonly kind: "flip"; readonly part: SkinPart }
  | { readonly kind: "copy"; readonly from: SkinPart; readonly to: SkinPart };

/** Arm and leg copies in a fixed order for menus. */
export const partCopies: ReadonlyArray<{ from: SkinPart; to: SkinPart }> = (
  ["rightArm", "leftArm", "rightLeg", "leftLeg"] as const
).map((from) => ({ from, to: pairedParts[from]! }));

/** The part whose pixels an action changes. */
export function actionTarget(action: PartAction) {
  return action.kind === "flip" ? action.part : action.to;
}

/**
 * Flip a part left to right, or copy an arm or leg onto its pair. Only the
 * active layer changes, and a hidden target part does not change.
 *
 * - Flip: the part looks as it does in a mirror. Its left and right sides
 *   swap, and every face reverses its columns.
 * - Copy: each face of the target gets the same face of the source, with the
 *   same rows and columns and no reflection. The front of the right arm, for
 *   example, becomes the front of the left arm as it is.
 *
 * RGBA values are copied unchanged. Unused pixels never change.
 */
export function transformPart(
  pixels: Uint8ClampedArray,
  builder: PatchBuilder,
  variant: SkinVariant,
  settings: { readonly layer: SkinLayer; readonly visibility: PartVisibility },
  action: PartAction,
) {
  const target = actionTarget(action);
  if (!settings.visibility[target][settings.layer]) return;
  if (action.kind === "copy" && pairedParts[action.from] !== action.to) return;
  const source = pixels.slice();
  for (const region of skinRegions(variant)) {
    if (region.layer !== settings.layer) continue;
    const from = action.kind === "flip" ? target : action.from;
    if (region.part !== from) continue;
    for (let y = region.y; y < region.y + region.height; y++)
      for (let x = region.x; x < region.x + region.width; x++) {
        const to =
          action.kind === "flip"
            ? flipPixel(variant, x, y)
            : pairedPixel(variant, x, y);
        if (!to) continue;
        const read = (y * SKIN_SIZE + x) * 4;
        builder.write(to.y * SKIN_SIZE + to.x, source.subarray(read, read + 4));
      }
  }
}
