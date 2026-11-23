import assert from "node:assert/strict";
import { test } from "node:test";
import { createTemplate, pixelOffset } from "./skin-document";
import type { SkinDocument } from "./skin-document";
import {
  browserStorage,
  DRAFT_KEY,
  discardDraft,
  readDraft,
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
