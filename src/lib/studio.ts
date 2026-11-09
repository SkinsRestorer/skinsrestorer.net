import type { SkinVariant } from "./skin";
import { ensureHttpsTextureUrl } from "./textures";
import { isGalleryId } from "./skin-gallery";

declare module "@tanstack/history" {
  interface HistoryState {
    /**
     * Marks the history entry of an open Studio editor, so Back returns to
     * the view. It is a random token for this visit, never a library ID.
     */
    readonly studioEditor?: string;
  }
}

/** What the generated command does on the server. */
export type StudioPurpose = "skin-url" | "createcustom";

/** `/studio` lets the user choose; `/upload` and `/generator` fix the purpose. */
export type StudioEntry = "studio" | "upload" | "generator";

/** The list beside the skin: skins in this browser, or the public gallery. */
export type SkinSource = "library" | "gallery";

/**
 * Public Studio state in the URL. It never holds library IDs, skin names,
 * API keys, or pixels: only public references that anyone may open.
 */
export interface StudioSearch {
  readonly intent?: StudioPurpose;
  /** A one-time editor handoff in this tab's session storage. */
  readonly handoff?: string;
  /** A textures.minecraft.net URL or hash. */
  readonly texture?: string;
  /** A public gallery skin ID. */
  readonly skin?: string;
  /** Omitted when it is the default for the other values. */
  readonly source?: SkinSource;
  /** The gallery search text. Only kept with the gallery shown. */
  readonly q?: string;
}

export const MAX_GALLERY_QUERY = 100;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function text(value: unknown) {
  // The router decodes `?q=123` as a number, so accept plain scalars.
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return typeof value === "string" ? value : undefined;
}

/** The list the Studio shows. A gallery link opens the gallery. */
export function skinSource(search: StudioSearch): SkinSource {
  return search.source ?? (search.skin ? "gallery" : "library");
}

/**
 * Validate and normalize Studio search parameters. Unknown values are
 * dropped. One skin reference wins: a handoff, then a texture, then a
 * gallery skin. Defaults are omitted, so equal states have equal URLs.
 */
export function studioSearch(search: Record<string, unknown>): StudioSearch {
  const result: Mutable<StudioSearch> = {};
  if (search.intent === "skin-url" || search.intent === "createcustom")
    result.intent = search.intent;
  const handoff = text(search.handoff)?.trim();
  const texture = text(search.texture)?.trim();
  const skin = text(search.skin);
  if (handoff && handoff.length <= 128) result.handoff = handoff;
  else if (texture && texture.length <= 512) result.texture = texture;
  else if (isGalleryId(skin)) result.skin = skin;
  const source =
    search.source === "library" || search.source === "gallery"
      ? search.source
      : undefined;
  const fallback = skinSource({ skin: result.skin });
  if (source && source !== fallback) result.source = source;
  const q = text(search.q)?.trim().slice(0, MAX_GALLERY_QUERY).trim();
  if (q && skinSource(result) === "gallery") result.q = q;
  return result;
}

/** Select a gallery skin. The list stays the one the user sees. */
export function withGallerySkin(
  search: StudioSearch,
  id: string,
): StudioSearch {
  const { handoff: _handoff, texture: _texture, ...rest } = search;
  return studioSearch({ ...rest, skin: id, source: skinSource(search) });
}

/**
 * Drop the public skin reference, for example when a library skin is
 * selected. The list stays the one the user sees.
 */
export function withoutSkinReference(search: StudioSearch): StudioSearch {
  const { handoff: _handoff, texture: _texture, skin: _skin, ...rest } = search;
  return studioSearch({ ...rest, source: skinSource(search) });
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
