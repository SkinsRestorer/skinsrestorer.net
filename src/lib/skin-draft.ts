import { Schema } from "effect";
import type { SkinVariant } from "./skin";
import { importSkinPng, type SkinDocument } from "./skin-document";

export const DRAFT_KEY = "skinsrestorer:editor:draft";
const DRAFT_VERSION = 1;
export const HANDOFF_KEY = "skinsrestorer:editor:handoff";

/** The storage methods the editor uses. Every call can throw in a browser. */
export type KeyValueStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

const variantSchema = Schema.Literals(["classic", "slim"]);
const draftSchema = Schema.Struct({
  version: Schema.Literal(DRAFT_VERSION),
  variant: variantSchema,
  png: Schema.String,
  updatedAt: Schema.Finite,
});
const versionSchema = Schema.Struct({ version: Schema.Finite });
const handoffSchema = Schema.Struct({
  version: Schema.Literal(DRAFT_VERSION),
  id: Schema.String,
  variant: variantSchema,
  png: Schema.String,
});

export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x80_00)
    binary += String.fromCodePoint(...bytes.subarray(i, i + 0x80_00));
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.codePointAt(i) ?? 0;
  return bytes;
}

/**
 * Return browser storage, or undefined when the browser blocks it. Full
 * storage is still returned: reads work, and each write handles its error.
 */
export function browserStorage(
  kind: "localStorage" | "sessionStorage",
): KeyValueStorage | undefined {
  try {
    const storage = window[kind];
    storage.getItem(DRAFT_KEY);
    return storage;
  } catch {
    return undefined;
  }
}

export type DraftReadResult =
  | { readonly status: "none" | "unavailable" | "corrupt" | "newer" }
  | {
      readonly status: "found";
      readonly document: SkinDocument;
      readonly updatedAt: number;
    };

async function decodeStoredSkin(png: string, variant: SkinVariant) {
  const imported = await importSkinPng(base64ToBytes(png));
  if (imported.legacy) throw new Error("Stored skins are always 64×64.");
  // Keep the model the user chose, not the detected one.
  return { pixels: imported.document.pixels, variant };
}

/** Read the saved draft. A damaged draft is reported and left for the user to discard. */
export async function readDraft(
  storage: Pick<KeyValueStorage, "getItem"> | undefined,
): Promise<DraftReadResult> {
  if (!storage) return { status: "unavailable" };
  let raw: string | null;
  try {
    raw = storage.getItem(DRAFT_KEY);
  } catch {
    return { status: "unavailable" };
  }
  if (raw === null) return { status: "none" };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { status: "corrupt" };
  }
  const version = Schema.decodeUnknownOption(versionSchema)(value);
  if (version._tag === "Some" && version.value.version > DRAFT_VERSION)
    return { status: "newer" };
  const draft = Schema.decodeUnknownOption(draftSchema)(value);
  if (draft._tag === "None") return { status: "corrupt" };
  try {
    return {
      status: "found",
      document: await decodeStoredSkin(draft.value.png, draft.value.variant),
      updatedAt: draft.value.updatedAt,
    };
  } catch {
    return { status: "corrupt" };
  }
}

export function discardDraft(storage: KeyValueStorage | undefined) {
  try {
    storage?.removeItem(DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
}

export interface SkinHandoff {
  readonly id: string;
  readonly file: File;
  readonly variant: SkinVariant;
}

/**
 * Read a handoff that the earlier editor (November 2026) left in this tab's
 * session storage for a `?handoff=` link. Nothing writes handoffs any more.
 */
export async function readHandoff(
  storage: Pick<KeyValueStorage, "getItem"> | undefined,
  id: string,
): Promise<SkinHandoff | undefined> {
  let raw: string | null | undefined;
  try {
    raw = storage?.getItem(HANDOFF_KEY);
  } catch {
    return undefined;
  }
  if (!raw) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const record = Schema.decodeUnknownOption(handoffSchema)(value);
  if (record._tag === "None" || record.value.id !== id) return undefined;
  try {
    const bytes = base64ToBytes(record.value.png);
    // Validate the image before the page shows it as a selected file.
    await importSkinPng(bytes);
    return {
      id,
      file: new File([bytes], "edited-skin.png", {
        type: "image/png",
      }),
      variant: record.value.variant,
    };
  } catch {
    return undefined;
  }
}
