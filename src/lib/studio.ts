import type { SkinVariant } from "./skin";
import { ensureHttpsTextureUrl } from "./textures";

/** What the generated command does on the server. */
export type StudioPurpose = "skin-url" | "createcustom";

/** `/studio` lets the user choose; `/upload` and `/generator` fix the purpose. */
export type StudioEntry = "studio" | "upload" | "generator";

export interface StudioSearch {
  readonly intent?: StudioPurpose;
  readonly texture?: string;
  readonly handoff?: string;
}

/** Search parameters for the Studio routes. Other values are dropped. */
export function studioSearch(search: Record<string, unknown>): StudioSearch {
  const result: { -readonly [K in keyof StudioSearch]: StudioSearch[K] } = {};
  if (search.intent === "skin-url" || search.intent === "createcustom")
    result.intent = search.intent;
  for (const key of ["texture", "handoff"] as const) {
    const value = search[key];
    if (typeof value === "string" && value) result[key] = value;
  }
  return result;
}

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
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\.png$/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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
    const url =
      decoded && typeof decoded === "object" && "textures" in decoded
        ? (decoded as { textures?: { SKIN?: { url?: unknown } } }).textures
            ?.SKIN?.url
        : undefined;
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
    value = (JSON.parse(text) as { value?: unknown })?.value;
  } catch {
    legacy = true;
    value = text.split("\n")[0]?.trim();
  }
  const url = typeof value === "string" ? textureUrlFromValue(value) : null;
  if (!url) throw new Error("No skin URL found in file");
  return { url, legacy };
}
