import assert from "node:assert/strict";
import { test } from "node:test";
import { createTemplate, importSkinPng, pixelOffset } from "./skin-document";
import type { SkinDocument } from "./skin-document";
import {
  browserStorage,
  DRAFT_KEY,
  discardDraft,
  HANDOFF_KEY,
  readDraft,
  readHandoff,
  writeHandoff,
  type KeyValueStorage,
} from "./skin-draft";
import { required } from "./utils";
import { blockedStorage, memoryStorage } from "@/test/fakes";
import { legacyDraftJson } from "@/test/skins";

/** Write a draft as the earlier editor version did. */
function storeDraft(
  storage: KeyValueStorage,
  document: SkinDocument,
  updatedAt = Date.now(),
) {
  storage.setItem(DRAFT_KEY, legacyDraftJson(document, updatedAt));
}

test("an earlier editor draft restores the same pixels and the chosen model", async () => {
  const storage = memoryStorage();
  const document = createTemplate("classic");
  document.pixels.set([1, 2, 3, 77], pixelOffset(40, 8));
  // The model is explicit, even if the pixels look like another model.
  const chosen = { pixels: document.pixels, variant: "slim" as const };
  storeDraft(storage, chosen, 1234);
  const draft = await readDraft(storage);
  assert.equal(draft.status, "found");
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
  assert.equal((await readDraft(blockedStorage)).status, "unavailable");
  assert.equal((await readDraft(undefined)).status, "unavailable");
  assert.equal(discardDraft(blockedStorage), false);
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
  const stored = required(storage.data.get(HANDOFF_KEY), "get result");
  // Another handoff replaces the copy in memory, as a reload would lose it.
  await writeHandoff(undefined, createTemplate("slim"), "other");
  storage.data.set(HANDOFF_KEY, stored);
  assert.equal((await readHandoff(storage, "reload"))?.variant, "classic");
  // Blocked storage still hands off through memory for client navigation.
  await writeHandoff(blockedStorage, createTemplate("slim"), "memory");
  assert.equal((await readHandoff(blockedStorage, "memory"))?.variant, "slim");
});

test("full storage stays readable, and blocked storage is reported", async () => {
  const full = memoryStorage();
  storeDraft(full, createTemplate("slim"), 5);
  full.setItem = () => {
    throw new DOMException(
      "The quota has been exceeded.",
      "QuotaExceededError",
    );
  };
  const scope = globalThis as { window?: unknown };
  const previous = scope.window;
  try {
    scope.window = { localStorage: full, sessionStorage: blockedStorage };
    const storage = required(browserStorage("localStorage"), "storage");
    assert.equal((await readDraft(storage)).status, "found");
    assert.equal(browserStorage("sessionStorage"), undefined);
  } finally {
    scope.window = previous;
  }
});
