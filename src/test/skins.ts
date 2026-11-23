/**
 * Skin fixtures shared by unit tests. Only test files import this module, so
 * it never reaches the app bundle.
 */
import { encodePngSync } from "@/lib/png";
import type { SkinDocument } from "@/lib/skin-document";
import { bytesToBase64 } from "@/lib/skin-draft";

/**
 * The stored value of a draft from the earlier editor version, which kept one
 * draft in local storage before the skin library existed.
 */
export function legacyDraftJson(
  document: Pick<SkinDocument, "pixels" | "variant">,
  updatedAt: number,
) {
  return JSON.stringify({
    version: 1,
    variant: document.variant,
    png: bytesToBase64(encodePngSync(document.pixels, 64, 64)),
    updatedAt,
  });
}
