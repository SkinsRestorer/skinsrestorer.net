import { messageFields, type LocalizedErrorFields } from "./messages";
import { Data, Effect, Schema } from "effect";
import { readHttpJson } from "./effect-http";
import { localizePath, type Locale } from "./i18n";
import type { SkinVariant } from "./skin";
import { parseTextureReference } from "./skin-texture";
import type { StudioPurpose } from "./studio";

export const GALLERY_URL = "https://cool-skins.skinsrestorer.net/list.json";

export interface GallerySkin {
  readonly id: string;
  readonly name: string;
  readonly textureUrl: string;
  readonly variant: SkinVariant;
}

export class GalleryError extends Data.TaggedError("GalleryError")<{
  readonly message: string;
  readonly messageKey?: LocalizedErrorFields["messageKey"];
  readonly messageValues?: LocalizedErrorFields["messageValues"];
}> {}

const catalogSchema = Schema.Struct({
  version: Schema.Literal(1),
  skins: Schema.Array(
    Schema.Struct({
      skinId: Schema.String,
      skinName: Schema.String,
      value: Schema.String,
      signature: Schema.String,
    }),
  ),
});

export function isGalleryId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 100 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}

/** Decode catalog metadata, accepting only Minecraft texture URLs. */
export function parseGalleryCatalog(input: unknown): readonly GallerySkin[] {
  return galleryEntries(Schema.decodeUnknownSync(catalogSchema)(input));
}

function galleryEntries(
  catalog: typeof catalogSchema.Type,
): readonly GallerySkin[] {
  if (catalog.skins.length > 1000) throw new Error("Too many gallery skins.");
  const ids = new Set<string>();
  return catalog.skins.map((skin) => {
    if (
      !isGalleryId(skin.skinId) ||
      ids.has(skin.skinId) ||
      !skin.skinName.trim() ||
      skin.skinName.length > 120 ||
      skin.value.length > 16_384 ||
      !skin.signature ||
      skin.signature.length > 4096
    )
      throw new Error("Invalid gallery entry.");
    ids.add(skin.skinId);
    const value = JSON.parse(atob(skin.value));
    const texture = value?.textures?.SKIN;
    const { url } = parseTextureReference(texture?.url);
    const model: unknown = texture?.metadata?.model;
    if (model !== undefined && model !== "slim" && model !== "classic")
      throw new Error("Invalid gallery model.");
    return {
      id: skin.skinId,
      name: skin.skinName.trim(),
      textureUrl: url,
      variant: model === "slim" ? "slim" : "classic",
    };
  });
}

/** Fetch the official catalog only. Browsing never writes to the library. */
export const loadGalleryEffect = Effect.fn("Skin.loadGallery")(function* () {
  const response = yield* readHttpJson(
    GALLERY_URL,
    {
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
    },
    catalogSchema,
    { timeoutMs: 15_000, maxBytes: 2 * 1024 * 1024 },
  ).pipe(
    Effect.mapError(
      () =>
        new GalleryError({
          ...messageFields("gallery.galleryCouldNotLoadedTryAgain"),
        }),
    ),
  );
  if (!response.ok)
    return yield* new GalleryError({
      ...messageFields("gallery.galleryCouldNotLoadedTryAgain"),
    });
  return yield* Effect.try({
    // readHttpJson already decoded the schema, so only entries are checked.
    try: () => galleryEntries(response.data),
    catch: () =>
      new GalleryError({
        ...messageFields("gallery.galleryCouldNotLoadedTryAgain"),
      }),
  });
});

function normalizeSearch(text: string) {
  return text
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Letters and digits only, so "darkknight" finds "Dark Knight". */
function compactSearch(text: string) {
  return text.replaceAll(/[^\p{L}\p{N}]/gu, "");
}

interface SearchName {
  readonly words: string;
  readonly compact: string;
}

/** Normalized names, kept per entry so each keystroke skips Unicode work. */
const searchNames = new WeakMap<GallerySkin, SearchName>();

/**
 * Match entries whose name contains every word, ignoring case, accents,
 * spaces, and punctuation inside a word.
 */
export function searchGallery(skins: readonly GallerySkin[], query: string) {
  const words = normalizeSearch(query)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({ word, compact: compactSearch(word) }));
  if (words.length === 0) return skins;
  return skins.filter((skin) => {
    let name = searchNames.get(skin);
    if (name === undefined) {
      const normalized = normalizeSearch(skin.name);
      name = { words: normalized, compact: compactSearch(normalized) };
      searchNames.set(skin, name);
    }
    const { words: text, compact } = name;
    return words.every(
      (word) =>
        text.includes(word.word) ||
        (word.compact !== "" && compact.includes(word.compact)),
    );
  });
}

/** Public catalog IDs only; browser library IDs never appear in links. */
export function galleryPermalink(
  id: string,
  locale: Locale,
  purpose?: StudioPurpose,
) {
  const search = new URLSearchParams({ skin: id });
  if (purpose) search.set("intent", purpose);
  return `${localizePath("/studio", locale)}?${search}`;
}
