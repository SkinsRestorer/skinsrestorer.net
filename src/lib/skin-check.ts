import type { SkinVariant } from "./skin";
import type { PatchBuilder } from "./skin-history";
import { regionAt, SKIN_SIZE, skinRegions } from "./skin-regions";

export type SkinIssueId =
  | "transparent-base"
  | "unused-pixels"
  | "possible-classic"
  | "possible-slim";

export interface SkinIssue {
  readonly id: SkinIssueId;
  readonly title: string;
  readonly detail: string;
  /** Pixels the issue covers, for the 2D highlight. */
  readonly pixels: readonly number[];
  /** A safe pixel repair. Model hints change only the selected model. */
  readonly repair?: { readonly label: string };
  readonly switchVariant?: SkinVariant;
}

function classicOnlyArmPixels() {
  const pixels: number[] = [];
  for (const region of skinRegions("classic")) {
    if (region.part !== "rightArm" && region.part !== "leftArm") continue;
    for (let y = region.y; y < region.y + region.height; y++)
      for (let x = region.x; x < region.x + region.width; x++)
        if (!regionAt("slim", x, y)) pixels.push(y * SKIN_SIZE + x);
  }
  return pixels;
}

const classicOnly = classicOnlyArmPixels();
const classicOnlySet = new Set(classicOnly);

/**
 * Find problems that change how the skin looks in Java Edition. The check
 * only reports. It never changes pixels; repairs run when the user asks.
 */
export function checkSkin(
  pixels: Uint8ClampedArray,
  variant: SkinVariant,
): SkinIssue[] {
  const issues: SkinIssue[] = [];
  const transparentBase: number[] = [];
  const unused: number[] = [];
  const filledClassicColumns = classicOnly.filter(
    (index) => pixels[index * 4 + 3] > 0,
  );
  const mayBeClassic = variant === "slim" && filledClassicColumns.length > 0;
  const mayBeSlim = variant === "classic" && filledClassicColumns.length === 0;
  for (let index = 0; index < SKIN_SIZE * SKIN_SIZE; index++) {
    // Model hints own the fourth arm column, so no repair can erase or fill
    // it while the model is in doubt.
    if ((mayBeClassic || mayBeSlim) && classicOnlySet.has(index)) continue;
    const alpha = pixels[index * 4 + 3];
    const region = regionAt(
      variant,
      index % SKIN_SIZE,
      Math.floor(index / SKIN_SIZE),
    );
    if (!region) {
      if (alpha > 0) unused.push(index);
    } else if (region.layer === "base" && alpha < 255)
      transparentBase.push(index);
  }
  if (transparentBase.length > 0)
    issues.push({
      id: "transparent-base",
      title: "See-through base pixels",
      detail: `${transparentBase.length} base ${transparentBase.length === 1 ? "pixel is" : "pixels are"} not opaque. The game shows them opaque.`,
      pixels: transparentBase,
      repair: { label: "Make opaque" },
    });
  if (unused.length > 0)
    issues.push({
      id: "unused-pixels",
      title: "Pixels in unused areas",
      detail: `${unused.length} ${unused.length === 1 ? "pixel is" : "pixels are"} outside the ${variant} model. The game ignores them.`,
      pixels: unused,
      repair: { label: "Clear unused areas" },
    });
  if (mayBeClassic)
    issues.push({
      id: "possible-classic",
      title: "This may be a classic skin",
      detail: "The wide arm columns have pixels. Check the preview.",
      pixels: filledClassicColumns,
      switchVariant: "classic",
    });
  if (mayBeSlim)
    issues.push({
      id: "possible-slim",
      title: "This may be a slim skin",
      detail: "The fourth arm column is empty. Check the preview.",
      pixels: classicOnly,
      switchVariant: "slim",
    });
  return issues;
}

/** Apply a repair to the pixels through the builder, so it is one undo step. */
export function repairSkin(
  id: SkinIssueId,
  pixels: Uint8ClampedArray,
  variant: SkinVariant,
  builder: PatchBuilder,
) {
  const issue = checkSkin(pixels, variant).find((i) => i.id === id);
  if (!issue?.repair) return;
  for (const index of issue.pixels) {
    const at = index * 4;
    if (id === "transparent-base")
      builder.write(index, [pixels[at], pixels[at + 1], pixels[at + 2], 255]);
    else if (id === "unused-pixels") builder.write(index, [0, 0, 0, 0]);
  }
}
