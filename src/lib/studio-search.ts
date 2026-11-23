/**
 * Studio URL state. Route `validateSearch` runs in the entry chunk, so this
 * module must not import anything: keep heavy helpers in `studio.ts`.
 */

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

/** The list beside the skin: skins in this browser, or the public gallery. */
export type SkinSource = "library" | "gallery";

/**
 * Public Studio state in the URL. It never holds library IDs, skin names,
 * API keys, or pixels: only public references that anyone may open.
 */
export interface StudioSearch {
  readonly intent?: StudioPurpose;
  /** A textures.minecraft.net URL or hash. */
  readonly texture?: string;
  /** A public gallery skin ID. */
  readonly skin?: string | undefined;
  /** Omitted when it is the default for the other values. */
  readonly source?: SkinSource;
  /** The gallery search text. Only kept with the gallery shown. */
  readonly q?: string | undefined;
}

export const MAX_GALLERY_QUERY = 100;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** A public gallery skin ID, such as `forest-ranger`. */
export function isGalleryId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 100 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)
  );
}

function stringParam(value: unknown) {
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
 * dropped. One skin reference wins: a texture, then a gallery skin. Defaults are omitted, so equal states have equal URLs.
 */
export function studioSearch(search: Record<string, unknown>): StudioSearch {
  const result: Mutable<StudioSearch> = {};
  if (search["intent"] === "skin-url" || search["intent"] === "createcustom")
    result.intent = search["intent"];
  const texture = stringParam(search["texture"])?.trim();
  const skin = stringParam(search["skin"]);
  if (texture && texture.length <= 512) result.texture = texture;
  else if (isGalleryId(skin)) result.skin = skin;
  const source =
    search["source"] === "library" || search["source"] === "gallery"
      ? search["source"]
      : undefined;
  const fallback = skinSource({ skin: result.skin });
  if (source && source !== fallback) result.source = source;
  const q = stringParam(search["q"])?.trim().slice(0, MAX_GALLERY_QUERY).trim();
  if (q && skinSource(result) === "gallery") result.q = q;
  return result;
}

/** Select a gallery skin. The list stays the one the user sees. */
export function withGallerySkin(
  search: StudioSearch,
  id: string,
): StudioSearch {
  const { texture: _texture, ...rest } = search;
  return studioSearch({ ...rest, skin: id, source: skinSource(search) });
}

/**
 * Drop the public skin reference, for example when a library skin is
 * selected. The list stays the one the user sees.
 */
export function withoutSkinReference(search: StudioSearch): StudioSearch {
  const { texture: _texture, skin: _skin, ...rest } = search;
  return studioSearch({ ...rest, source: skinSource(search) });
}
