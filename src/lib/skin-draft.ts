import { Schema } from "effect";
import { encodePngSync } from "./png";
import type { SkinVariant } from "./skin";
import {
  exportSkinPng,
  importSkinPng,
  type SkinDocument,
} from "./skin-document";
import { SKIN_SIZE } from "./skin-regions";

export const DRAFT_KEY = "skinsrestorer:editor:draft";
export const DRAFT_VERSION = 1;
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
  updatedAt: Schema.Number,
});
const versionSchema = Schema.Struct({ version: Schema.Number });
const handoffSchema = Schema.Struct({
  version: Schema.Literal(DRAFT_VERSION),
  id: Schema.String,
  variant: variantSchema,
  png: Schema.String,
});

export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Return browser storage, or undefined when the browser blocks it. */
export function browserStorage(
  kind: "localStorage" | "sessionStorage",
): KeyValueStorage | undefined {
  try {
    const storage = window[kind];
    const probe = `${DRAFT_KEY}:probe`;
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return undefined;
  }
}

export type DraftSaveResult = "saved" | "unavailable" | "full";

function isQuotaError(cause: unknown) {
  return (
    cause instanceof DOMException &&
    (cause.name === "QuotaExceededError" ||
      cause.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

/** Save synchronously, so the page can also save while it unloads. */
export function saveDraft(
  storage: KeyValueStorage | undefined,
  document: SkinDocument,
  now = Date.now(),
): DraftSaveResult {
  if (!storage) return "unavailable";
  const png = bytesToBase64(
    encodePngSync(document.pixels, SKIN_SIZE, SKIN_SIZE),
  );
  try {
    storage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        version: DRAFT_VERSION,
        variant: document.variant,
        png,
        updatedAt: now,
      }),
    );
    return "saved";
  } catch (cause) {
    return isQuotaError(cause) ? "full" : "unavailable";
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
  storage: KeyValueStorage | undefined,
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
 * A handoff is a snapshot for one navigation in this tab. It does not read the
 * draft, so another tab or a later edit cannot change what the target page
 * receives. Pages in this tab can still read it after a reload.
 */
const memoryHandoffs = new Map<string, string>();

export async function writeHandoff(
  storage: KeyValueStorage | undefined,
  document: SkinDocument,
  id: string = crypto.randomUUID(),
) {
  const record = JSON.stringify({
    version: DRAFT_VERSION,
    id,
    variant: document.variant,
    png: bytesToBase64(await exportSkinPng(document.pixels)),
  });
  memoryHandoffs.clear();
  memoryHandoffs.set(id, record);
  try {
    storage?.setItem(HANDOFF_KEY, record);
  } catch {
    // Client-side navigation still reads the copy in memory.
  }
  return id;
}

export async function readHandoff(
  storage: KeyValueStorage | undefined,
  id: string,
): Promise<SkinHandoff | undefined> {
  let raw = memoryHandoffs.get(id);
  if (!raw)
    try {
      raw = storage?.getItem(HANDOFF_KEY) ?? undefined;
    } catch {
      raw = undefined;
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
      file: new File([bytes as Uint8Array<ArrayBuffer>], "edited-skin.png", {
        type: "image/png",
      }),
      variant: record.value.variant,
    };
  } catch {
    return undefined;
  }
}
