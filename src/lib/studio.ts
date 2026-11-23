import { MessageError } from "./messages";
import type { SkinVariant } from "./skin";
import { ensureHttpsTextureUrl } from "./textures";
import type { StudioPurpose } from "./studio-search";

export {
  MAX_GALLERY_QUERY,
  skinSource,
  studioSearch,
  withGallerySkin,
  withoutSkinReference,
  type SkinSource,
  type StudioPurpose,
  type StudioSearch,
} from "./studio-search";

/** `/studio` lets the user choose; `/upload` and `/generator` fix the purpose. */
export type StudioEntry = "studio" | "upload" | "generator";

/**
 * The purpose an entry URL fixes. Upload and Generator always win over a
 * contradictory `intent`; on `/studio` an intent selects and fixes a purpose.
 */
export function fixedPurpose(
  entry: StudioEntry,
  intent?: StudioPurpose,
): StudioPurpose | undefined {
  if (entry === "upload") return "skin-url";
  if (entry === "generator") return "createcustom";
  return intent;
}

/** A custom skin name suggestion from a library name, such as "Forest ranger". */
export function suggestSkinName(name: string) {
  return name
    .normalize("NFKD")
    .replaceAll(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .replace(/\.png$/u, "")
    .replaceAll(/[^a-z0-9]+/gu, "_")
    .replaceAll(/^_+|_+$/gu, "");
}

/**
 * The /sr createcustom name when the name field is empty: the suggestion
 * from the PNG filename, which for a library skin is its library name.
 * The field shows it as the placeholder, so the command matches it.
 */
export function defaultSkinName(fileName: string) {
  return suggestSkinName(fileName) || "custom_skin";
}

export function generatedCommand(
  purpose: StudioPurpose,
  result: { readonly url: string; readonly name: string },
  variant: SkinVariant,
) {
  return purpose === "createcustom"
    ? `/sr createcustom ${result.name} "${result.url}" ${variant}`
    : `/skin url "${result.url}" ${variant}`;
}

/** The textures.minecraft.net URL inside a signed texture property value. */
export function textureUrlFromValue(value: string): string | null {
  try {
    const decoded: unknown = JSON.parse(atob(value));
    const textures =
      decoded && typeof decoded === "object" && "textures" in decoded
        ? decoded.textures
        : undefined;
    const skin =
      textures && typeof textures === "object" && "SKIN" in textures
        ? textures.SKIN
        : undefined;
    const url =
      skin && typeof skin === "object" && "url" in skin ? skin.url : undefined;
    return typeof url === "string"
      ? (ensureHttpsTextureUrl(url) ?? null)
      : null;
  } catch {
    return null;
  }
}

/**
 * Read the skin texture URL from a SkinsRestorer storage file. Current files
 * are JSON with a `value`; legacy files keep the value on the first line.
 */
export function readSkinFileTexture(text: string): {
  readonly url: string;
  readonly legacy: boolean;
} {
  let value: unknown;
  let legacy = false;
  try {
    const parsed: unknown = JSON.parse(text);
    value =
      parsed && typeof parsed === "object" && "value" in parsed
        ? parsed.value
        : undefined;
  } catch {
    legacy = true;
    value = text.split("\n")[0]?.trim();
  }
  const url = typeof value === "string" ? textureUrlFromValue(value) : null;
  if (!url) throw new MessageError("studio.noSkinUrlFoundFile");
  return { url, legacy };
}
