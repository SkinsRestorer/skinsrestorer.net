import assert from "node:assert/strict";
import { test } from "node:test";
import { encodePngSync } from "./png";
import { createTemplate, importSkinPng, pixelOffset } from "./skin-document";
import type { SkinDocument } from "./skin-document";
import {
  bytesToBase64,
  DRAFT_KEY,
  discardDraft,
  HANDOFF_KEY,
  readDraft,
  readHandoff,
  writeHandoff,
  type KeyValueStorage,
} from "./skin-draft";

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

/** Write a draft as the earlier editor version did. */
function storeDraft(
  storage: KeyValueStorage,
  document: SkinDocument,
  updatedAt = Date.now(),
) {
  storage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      version: 1,
      variant: document.variant,
      png: bytesToBase64(encodePngSync(document.pixels, 64, 64)),
      updatedAt,
    }),
  );
}

const throwing: KeyValueStorage = {
  getItem: () => {
    throw new DOMException("blocked", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("blocked", "SecurityError");
  },
  removeItem: () => {
    throw new DOMException("blocked", "SecurityError");
  },
};

test("an earlier editor draft restores the same pixels and the chosen model", async () => {
  const storage = memoryStorage();
  const document = createTemplate("classic");
  document.pixels.set([1, 2, 3, 77], pixelOffset(40, 8));
  // The model is explicit, even if the pixels look like another model.
  const chosen = { pixels: document.pixels, variant: "slim" as const };
  storeDraft(storage, chosen, 1234);
  const draft = await readDraft(storage);
  assert.equal(draft.status, "found");
  if (draft.status !== "found") return;
  assert.deepEqual(draft.document.pixels, document.pixels);
  assert.equal(draft.document.variant, "slim");
  assert.equal(draft.updatedAt, 1234);
  assert.equal(discardDraft(storage), true);
  assert.equal((await readDraft(storage)).status, "none");
});

test("damaged, newer, and blocked storage are reported without throwing", async () => {
  const storage = memoryStorage();
  storage.data.set(DRAFT_KEY, "{not json");
  assert.equal((await readDraft(storage)).status, "corrupt");
  storage.data.set(
    DRAFT_KEY,
    JSON.stringify({
      version: 1,
      variant: "classic",
      png: "AAAA",
      updatedAt: 1,
    }),
  );
  assert.equal((await readDraft(storage)).status, "corrupt");
  storage.data.set(DRAFT_KEY, JSON.stringify({ version: 2 }));
  assert.equal((await readDraft(storage)).status, "newer");
  assert.equal((await readDraft(throwing)).status, "unavailable");
  assert.equal((await readDraft(undefined)).status, "unavailable");
  assert.equal(discardDraft(throwing), false);
});

test("a handoff is a stable snapshot with its explicit model", async () => {
  const storage = memoryStorage();
  const document = createTemplate("classic");
  // The pixels look classic, but the user chose slim.
  const id = await writeHandoff(
    storage,
    { pixels: document.pixels, variant: "slim" },
    "a",
  );
  // A later draft from this or another tab does not change the handoff.
  storeDraft(storage, createTemplate("slim"));
  const handoff = await readHandoff(storage, id);
  assert.ok(handoff);
  assert.equal(handoff.variant, "slim");
  assert.equal(handoff.file.type, "image/png");
  const bytes = new Uint8Array(await handoff.file.arrayBuffer());
  assert.deepEqual(
    (await importSkinPng(bytes)).document.pixels,
    document.pixels,
  );
  // A different id, such as an old link, gets nothing.
  assert.equal(await readHandoff(storage, "b"), undefined);
});

test("a handoff survives a page reload through storage and works without storage", async () => {
  const storage = memoryStorage();
  await writeHandoff(storage, createTemplate("classic"), "reload");
  const stored = storage.data.get(HANDOFF_KEY)!;
  // Another handoff replaces the copy in memory, as a reload would lose it.
  await writeHandoff(undefined, createTemplate("slim"), "other");
  storage.data.set(HANDOFF_KEY, stored);
  assert.equal((await readHandoff(storage, "reload"))?.variant, "classic");
  // Blocked storage still hands off through memory for client navigation.
  await writeHandoff(throwing, createTemplate("slim"), "memory");
  assert.equal((await readHandoff(throwing, "memory"))?.variant, "slim");
});
