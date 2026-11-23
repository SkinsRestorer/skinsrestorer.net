import {
  messageFields,
  messageKeySchema,
  messageValuesSchema,
} from "./messages";
import { Effect, Schema } from "effect";
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

// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is a class factory.
class GalleryError extends Schema.TaggedError<
  GalleryError,
  { readonly brand: unique symbol }
>()("GalleryError", {
  message: Schema.String,
  messageKey: Schema.optional(messageKeySchema),
  messageValues: Schema.optional(messageValuesSchema),
}) {}

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

// The base64 `value` of a gallery entry: Minecraft's textures property.
const decodeTextures = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Struct({
      textures: Schema.Struct({
        SKIN: Schema.Struct({
          url: Schema.String,
          metadata: Schema.optional(
            Schema.Struct({ model: Schema.optional(Schema.Unknown) }),
          ),
        }),
      }),
    }),
  ),
);

export function isGalleryId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 100 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)
  );
}

export interface GalleryCatalog {
  readonly skins: readonly GallerySkin[];
  /** Entries left out because they were invalid or unsafe. */
  readonly skipped: number;
}

/** Decode catalog metadata, accepting only Minecraft texture URLs. */
export function parseGalleryCatalog(input: unknown): GalleryCatalog {
  return galleryEntries(Schema.decodeUnknownSync(catalogSchema)(input));
}

type CatalogEntry = (typeof catalogSchema.Type)["skins"][number];

/** One checked entry, or undefined when it is invalid or unsafe. */
function galleryEntry(skin: CatalogEntry): GallerySkin | undefined {
  if (
    !isGalleryId(skin.skinId) ||
    !skin.skinName.trim() ||
    skin.skinName.length > 120 ||
    skin.value.length > 16_384 ||
    !skin.signature ||
    skin.signature.length > 4096
  )
    return undefined;
  try {
    const texture = decodeTextures(atob(skin.value)).textures.SKIN;
    const { url } = parseTextureReference(texture.url);
    const model = texture.metadata?.model;
    if (model !== undefined && model !== "slim" && model !== "classic")
      return undefined;
    return {
      id: skin.skinId,
      name: skin.skinName.trim(),
      textureUrl: url,
      variant: model === "slim" ? "slim" : "classic",
    };
  } catch {
    return undefined;
  }
}

/**
 * Keep the valid entries. One bad entry is skipped and counted, so it does
 * not hide the rest of the gallery. The catalog fails only when it has
 * entries and none of them are valid. A repeated id keeps its first entry.
 */
function galleryEntries(catalog: typeof catalogSchema.Type): GalleryCatalog {
  if (catalog.skins.length > 1000) throw new Error("Too many gallery skins.");
  const ids = new Set<string>();
  const skins: GallerySkin[] = [];
  for (const entry of catalog.skins) {
    const skin = ids.has(entry.skinId) ? undefined : galleryEntry(entry);
    if (!skin) continue;
    ids.add(skin.id);
    skins.push(skin);
  }
  if (skins.length === 0 && catalog.skins.length > 0)
    throw new Error("No valid gallery entries.");
  return { skins, skipped: catalog.skins.length - skins.length };
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
    Effect.mapError(() =>
      GalleryError.make({
        ...messageFields("gallery.galleryCouldNotLoadedTryAgain"),
      }),
    ),
  );
  if (!response.ok)
    return yield* GalleryError.make({
      ...messageFields("gallery.galleryCouldNotLoadedTryAgain"),
    });
  const catalog = yield* Effect.try({
    // readHttpJson already decoded the schema, so only entries are checked.
    try: () => galleryEntries(response.data),
    catch: () =>
      GalleryError.make({
        ...messageFields("gallery.galleryCouldNotLoadedTryAgain"),
      }),
  });
  if (catalog.skipped > 0)
    yield* Effect.logWarning("Skipped invalid gallery entries.").pipe(
      Effect.annotateLogs({ skipped: catalog.skipped }),
    );
  return catalog.skins;
});

function normalizeSearch(text: string) {
  return text
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036F]/gu, "")
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
    .split(/\s+/u)
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
