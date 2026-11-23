import assert from "node:assert/strict";
import { test } from "node:test";
import { createTemplate, importSkinPng, pixelOffset } from "./skin-document";
import type { SkinDocument } from "./skin-document";
import { encodePngSync } from "./png";
import {
  browserStorage,
  bytesToBase64,
  DRAFT_KEY,
  discardDraft,
  HANDOFF_KEY,
  readDraft,
  readHandoff,
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

/** Store a handoff as the earlier editor did before opening Upload. */
function storeHandoff(
  storage: KeyValueStorage,
  id: string,
  document: SkinDocument,
) {
  storage.setItem(
    HANDOFF_KEY,
    JSON.stringify({
      version: 1,
      id,
      variant: document.variant,
      png: bytesToBase64(encodePngSync(document.pixels, 64, 64)),
    }),
  );
}

test("an earlier handoff restores its pixels and explicit model once per id", async () => {
  const storage = memoryStorage();
  const document = createTemplate("classic");
  // The pixels look classic, but the user chose slim.
  storeHandoff(storage, "a", { pixels: document.pixels, variant: "slim" });
  // A draft from this or another tab does not change the handoff.
  storeDraft(storage, createTemplate("slim"));
  const handoff = await readHandoff(storage, "a");
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

test("a damaged, missing, or blocked handoff reads as gone", async () => {
  const storage = memoryStorage();
  assert.equal(await readHandoff(storage, "a"), undefined);
  storage.data.set(HANDOFF_KEY, "{not json");
  assert.equal(await readHandoff(storage, "a"), undefined);
  storage.data.set(
    HANDOFF_KEY,
    JSON.stringify({ version: 1, id: "a", variant: "slim", png: "AAAA" }),
  );
  assert.equal(await readHandoff(storage, "a"), undefined);
  assert.equal(await readHandoff(blockedStorage, "a"), undefined);
  assert.equal(await readHandoff(undefined, "a"), undefined);
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
