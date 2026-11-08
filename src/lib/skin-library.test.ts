import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { Effect } from "effect";
import { IDBFactory } from "fake-indexeddb";
import { encodePngSync } from "./png";
import { createTemplate, exportSkinPng, pixelOffset } from "./skin-document";
import {
  createLibraryClient,
  migrateLegacyDraft,
  type LibraryClient,
} from "./skin-library-client";
import { DRAFT_KEY, type KeyValueStorage } from "./skin-draft";
import {
  LIBRARY_DB,
  prepareSkinContent,
  SkinChangedError,
  SkinLibrary,
  SkinLibraryError,
  SkinNotFoundError,
  skinLibraryLayer,
  type LibraryChannel,
  type SkinContent,
} from "./skin-library";
import type { SkinVariant } from "./skin";

const clients: LibraryClient[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.dispose()));
});

/** Tabs in one browser share the factory and a broadcast bus. */
function browser() {
  const factory = new IDBFactory();
  const tabs = new Set<() => void>();
  const channel = (): LibraryChannel => {
    let listener: (() => void) | undefined;
    const receive = () => listener?.();
    tabs.add(receive);
    return {
      postMessage: () => {
        for (const tab of tabs) if (tab !== receive) queueMicrotask(tab);
      },
      addEventListener: (_type, next) => {
        listener = next;
      },
      close: () => void tabs.delete(receive),
    };
  };
  let ids = 0;
  const tab = (factoryOverride: IDBFactory = factory) => {
    const client = createLibraryClient(
      skinLibraryLayer({
        factory: factoryOverride,
        channel,
        id: () => `id-${++ids}`,
      }),
    );
    clients.push(client);
    return client;
  };
  return { factory, tab };
}

const use = <A, E>(
  client: LibraryClient,
  f: (library: SkinLibrary["Service"]) => Effect.Effect<A, E>,
) =>
  client.run(
    Effect.gen(function* () {
      return yield* f(yield* SkinLibrary);
    }),
  );

async function skinPng(seed: number, variant: SkinVariant = "classic") {
  const document = createTemplate(variant);
  document.pixels.set([seed, 2, 3, 255], pixelOffset(8, 8));
  return new Blob(
    [(await exportSkinPng(document.pixels)) as Uint8Array<ArrayBuffer>],
    {
      type: "image/png",
    },
  );
}

const prepare = (blob: Blob, variant?: SkinVariant) =>
  Effect.runPromise(prepareSkinContent(blob, variant));

async function bytes(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

async function addSkin(
  client: LibraryClient,
  content: SkinContent,
  name = "Harbor",
) {
  return use(client, (library) =>
    library.add({ name, content, source: { kind: "file" } }, { dedupe: true }),
  );
}

async function failure(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (cause) {
    return cause;
  }
  assert.fail("expected a failure");
}

test("prepares exact bytes, hashes, and canonical keys outside transactions", async () => {
  const png = await skinPng(1);
  const content = await prepare(png);
  assert.deepEqual(await bytes(content.png), await bytes(png));
  assert.match(content.hash, /^[0-9a-f]{64}$/);
  assert.equal(content.variant, "classic");
  assert.equal(content.key, `${content.pixelKey}:classic`);
  // The same pixels in another PNG encoding have the same canonical key.
  const document = createTemplate("classic");
  document.pixels.set([1, 2, 3, 255], pixelOffset(8, 8));
  const other = await prepare(
    new Blob([
      encodePngSync(document.pixels, 64, 64) as Uint8Array<ArrayBuffer>,
    ]),
  );
  assert.equal(other.pixelKey, content.pixelKey);
  // HD skins are accepted for upload and keyed by their bytes.
  const hd = await prepare(
    new Blob([
      encodePngSync(
        new Uint8ClampedArray(128 * 128 * 4),
        128,
        128,
      ) as Uint8Array<ArrayBuffer>,
    ]),
  );
  assert.equal(hd.width, 128);
  assert.equal(hd.pixelKey, `file:${hd.hash}`);
});

test("rejects files that are not skin PNGs or are larger than 5 MB", async () => {
  const notPng = await failure(prepare(new Blob(["hello"])));
  assert.ok(notPng instanceof SkinLibraryError);
  assert.equal(notPng.reason, "invalid");
  const wide = await failure(
    prepare(
      new Blob([
        encodePngSync(
          new Uint8ClampedArray(64 * 16 * 4),
          64,
          16,
        ) as Uint8Array<ArrayBuffer>,
      ]),
    ),
  );
  assert.ok(wide instanceof SkinLibraryError);
  assert.match(wide.message, /64×16/);
  const large = await failure(
    prepare(new Blob([new Uint8Array(5 * 1024 * 1024 + 1)])),
  );
  assert.ok(large instanceof SkinLibraryError);
  assert.match(large.message, /5 MB/);
});

test("repeated imports reuse one skin, while duplicates are always new", async () => {
  const { tab } = browser();
  const client = tab();
  const content = await prepare(await skinPng(1));
  const first = await addSkin(client, content);
  const again = await addSkin(client, await prepare(await skinPng(1)));
  assert.equal(first.created, true);
  assert.equal(again.created, false);
  assert.equal(again.skin.id, first.skin.id);
  assert.ok(again.skin.lastUsedAt >= first.skin.lastUsedAt);
  // The same pixels with the other model are a different skin.
  const slim = await addSkin(client, await prepare(await skinPng(1), "slim"));
  assert.equal(slim.created, true);
  const copy = await use(client, (library) => library.duplicate(first.skin.id));
  assert.notEqual(copy.id, first.skin.id);
  assert.equal(copy.name, "Harbor copy");
  assert.equal(copy.source.copiedFrom, first.skin.id);
  assert.equal(copy.current.key, first.skin.current.key);
  const listing = await use(client, (library) => library.list);
  assert.equal(listing.skins.length, 3);
});

test("skins survive a reload with the exact bytes", async () => {
  const { tab } = browser();
  const png = await skinPng(3);
  const { skin } = await addSkin(tab(), await prepare(png));
  const reloaded = tab();
  const stored = await use(reloaded, (library) => library.get(skin.id));
  assert.deepEqual(await bytes(stored.current.png), await bytes(png));
  assert.deepEqual(await bytes(stored.original.png), await bytes(png));
});

test("save keeps the original, and revert restores its bytes and model", async () => {
  const { tab } = browser();
  const client = tab();
  const original = await prepare(await skinPng(1));
  const { skin } = await addSkin(client, original);
  const edited = await prepare(await skinPng(9), "slim");
  const saved = await use(client, (library) =>
    library.commitSession({
      sessionId: "s1",
      skinId: skin.id,
      baseRevision: skin.revision,
      content: edited,
      replace: false,
    }),
  );
  assert.equal(saved.current.hash, edited.hash);
  assert.equal(saved.current.variant, "slim");
  assert.equal(saved.original.hash, original.hash);
  assert.equal(saved.revision, skin.revision + 1);
  const { skin: reverted, previous } = await use(client, (library) =>
    library.revert(skin.id),
  );
  assert.deepEqual(
    await bytes(reverted.current.png),
    await bytes(original.png),
  );
  assert.equal(reverted.current.variant, "classic");
  assert.equal(previous.hash, edited.hash);
  const undone = await use(client, (library) =>
    library.setContent(skin.id, previous),
  );
  assert.equal(undone.current.variant, "slim");
  assert.ok(undone.revision > reverted.revision);
});

test("save as copy leaves the source byte-identical", async () => {
  const { tab } = browser();
  const client = tab();
  const png = await skinPng(1);
  const { skin } = await addSkin(client, await prepare(png));
  await use(client, (library) =>
    library.saveSession({
      id: "s1",
      skinId: skin.id,
      baseRevision: skin.revision,
      name: skin.name,
      png: new Blob([]),
      variant: "classic",
      updatedAt: 1,
    }),
  );
  const copy = await use(client, (library) =>
    library.createFromSession({
      sessionId: "s1",
      skin: {
        name: "Harbor copy",
        content: { ...skin.current, variant: "slim" },
        source: { kind: "copy", copiedFrom: skin.id },
      },
    }),
  );
  const listing = await use(client, (library) => library.list);
  const source = listing.skins.find((entry) => entry.id === skin.id)!;
  assert.notEqual(copy.id, skin.id);
  assert.equal(source.revision, skin.revision);
  assert.deepEqual(await bytes(source.current.png), await bytes(png));
  assert.equal(listing.sessions.length, 0);
});

test("two tabs keep separate drafts and saves conflict on pixels and on model", async () => {
  const { tab } = browser();
  const a = tab();
  const b = tab();
  const { skin } = await addSkin(a, await prepare(await skinPng(1)));
  const draft = (id: string, seed: number) =>
    skinPng(seed).then((png) => ({
      id,
      skinId: skin.id,
      baseRevision: skin.revision,
      name: skin.name,
      png,
      variant: "classic" as const,
      updatedAt: seed,
    }));
  const draftA = await draft("a", 2);
  const draftB = await draft("b", 3);
  await use(a, (library) => library.saveSession(draftA));
  await use(b, (library) => library.saveSession(draftB));
  const both = await use(b, (library) => library.list);
  assert.deepEqual(both.sessions.map((session) => session.id).sort(), [
    "a",
    "b",
  ]);

  // Tab B changes only the model. Tab A's save must not silently win.
  await use(b, (library) => library.setVariant(skin.id, "slim"));
  const content = await prepare(await skinPng(2));
  const conflict = await failure(
    use(a, (library) =>
      library.commitSession({
        sessionId: "a",
        skinId: skin.id,
        baseRevision: skin.revision,
        content,
        replace: false,
      }),
    ),
  );
  assert.ok(conflict instanceof SkinChangedError);
  assert.equal(conflict.skin.current.variant, "slim");
  // The failed save left tab A's draft in place.
  const after = await use(a, (library) => library.list);
  assert.equal(after.sessions.length, 2);
  // Replace is an explicit choice.
  const replaced = await use(a, (library) =>
    library.commitSession({
      sessionId: "a",
      skinId: skin.id,
      baseRevision: skin.revision,
      content,
      replace: true,
    }),
  );
  assert.equal(replaced.current.hash, content.hash);
  const final = await use(b, (library) => library.list);
  assert.deepEqual(
    final.sessions.map((session) => session.id),
    ["b"],
  );
});

test("a recovered draft moves to a new session owned by the editor", async () => {
  const { tab } = browser();
  const client = tab();
  const png = await skinPng(4);
  const old = {
    id: "old",
    name: "Harbor",
    png,
    variant: "slim" as const,
    updatedAt: 1,
  };
  await use(client, (library) => library.saveSession(old));
  await use(client, (library) =>
    library.continueSession("old", { ...old, id: "new", updatedAt: 2 }),
  );
  const listing = await use(client, (library) => library.list);
  assert.deepEqual(
    listing.sessions.map((session) => session.id),
    ["new"],
  );
  const missing = await failure(
    use(client, (library) =>
      library.continueSession("old", { ...old, id: "x" }),
    ),
  );
  assert.ok(missing instanceof SkinNotFoundError);
});

test("removing a skin removes its sessions, and undo restores both", async () => {
  const { tab } = browser();
  const a = tab();
  const b = tab();
  const { skin } = await addSkin(a, await prepare(await skinPng(1)));
  const draftPng = await skinPng(2);
  await use(a, (library) =>
    library.saveSession({
      id: "s1",
      skinId: skin.id,
      baseRevision: skin.revision,
      name: skin.name,
      png: draftPng,
      variant: "classic",
      updatedAt: 1,
    }),
  );
  const removed = await use(b, (library) => library.remove(skin.id));
  assert.equal(removed.sessions.length, 1);
  // The editor in tab A can no longer save into the removed skin.
  const missing = await failure(
    use(a, (library) =>
      library.commitSession({
        sessionId: "s1",
        skinId: skin.id,
        baseRevision: skin.revision,
        content: skin.current,
        replace: false,
      }),
    ),
  );
  assert.ok(missing instanceof SkinNotFoundError);
  await use(b, (library) => library.restore(removed));
  const listing = await use(a, (library) => library.list);
  assert.equal(listing.skins[0].id, skin.id);
  assert.equal(listing.sessions[0].id, "s1");
});

test("other tabs are told about committed changes", async () => {
  const { tab } = browser();
  const a = tab();
  const b = tab();
  await use(b, (library) => library.list);
  const events: string[] = [];
  const stop = b.subscribe((event) => events.push(event.type));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await addSkin(a, await prepare(await skinPng(1)));
  await new Promise((resolve) => setTimeout(resolve, 0));
  stop();
  assert.deepEqual(events, ["changed"]);
});

test("damaged records are reported and can be removed, never overwritten", async () => {
  const { factory, tab } = browser();
  const client = tab();
  await addSkin(client, await prepare(await skinPng(1)));
  await new Promise<void>((resolve, reject) => {
    const open = factory.open(LIBRARY_DB);
    open.onsuccess = () => {
      const tx = open.result.transaction("skins", "readwrite");
      tx.objectStore("skins").put({ id: "broken", name: 5 });
      tx.oncomplete = () => {
        open.result.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
  const listing = await use(client, (library) => library.list);
  assert.equal(listing.skins.length, 1);
  assert.deepEqual(listing.damaged, [{ store: "skins", key: "broken" }]);
  const damaged = await failure(
    use(client, (library) => library.get("broken")),
  );
  assert.ok(damaged instanceof SkinLibraryError);
  assert.equal(damaged.reason, "damaged");
  await use(client, (library) => library.removeDamaged(listing.damaged[0]));
  assert.equal(
    (await use(client, (library) => library.list)).damaged.length,
    0,
  );
});

test("unavailable, newer, and full storage fail with typed errors", async () => {
  const blocked = createLibraryClient(
    skinLibraryLayer({
      factory: {
        open: () => {
          throw new DOMException("blocked", "SecurityError");
        },
      } as unknown as IDBFactory,
    }),
  );
  clients.push(blocked);
  const unavailable = await failure(use(blocked, (library) => library.list));
  assert.ok(unavailable instanceof SkinLibraryError);
  assert.equal(unavailable.reason, "unavailable");

  const { factory, tab } = browser();
  await new Promise<void>((resolve) => {
    const open = factory.open(LIBRARY_DB, 5);
    open.onsuccess = () => {
      open.result.close();
      resolve();
    };
  });
  const newer = await failure(use(tab(), (library) => library.list));
  assert.ok(newer instanceof SkinLibraryError);
  assert.equal(newer.reason, "newer");

  const full = browser();
  const client = full.tab(quotaFactory(full.factory));
  const error = await failure(addSkin(client, await prepare(await skinPng(1))));
  assert.ok(error instanceof SkinLibraryError);
  assert.equal(error.reason, "full");
  // Nothing was half written.
  const listing = await use(full.tab(), (library) => library.list);
  assert.equal(listing.skins.length, 0);
});

test("an interrupted write aborts its transaction", async () => {
  const { tab } = browser();
  const client = tab();
  await use(client, (library) => library.list);
  const content = await prepare(await skinPng(1));
  const controller = new AbortController();
  const pending = client.run(
    Effect.gen(function* () {
      const library = yield* SkinLibrary;
      return yield* library.add(
        { name: "Harbor", content, source: { kind: "file" } },
        { dedupe: false },
      );
    }),
    controller.signal,
  );
  controller.abort();
  await failure(pending);
  const listing = await use(client, (library) => library.list);
  assert.equal(listing.skins.length, 0);
});

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

async function legacyDraft(variant: SkinVariant = "slim") {
  const document = createTemplate("classic");
  const png = encodePngSync(document.pixels, 64, 64);
  let binary = "";
  for (const byte of png) binary += String.fromCharCode(byte);
  return JSON.stringify({
    version: 1,
    variant,
    png: btoa(binary),
    updatedAt: 1000,
  });
}

test("the old editor draft migrates once, even from two tabs", async () => {
  const { tab } = browser();
  const storage = memoryStorage();
  storage.data.set(DRAFT_KEY, await legacyDraft());
  const second = memoryStorage();
  second.data.set(DRAFT_KEY, storage.data.get(DRAFT_KEY)!);
  const [first, other] = await Promise.all([
    migrateLegacyDraft(tab(), storage),
    migrateLegacyDraft(tab(), second),
  ]);
  assert.deepEqual([first.status, other.status].sort(), ["migrated", "none"]);
  assert.equal(storage.data.has(DRAFT_KEY), false);
  assert.equal(second.data.has(DRAFT_KEY), false);
  const listing = await use(tab(), (library) => library.list);
  assert.equal(listing.skins.length, 1);
  assert.equal(listing.skins[0].source.kind, "migrated-draft");
  assert.equal(listing.skins[0].current.variant, "slim");
  assert.match(listing.skins[0].name, /^Recovered draft/);
});

test("migration preserves a newer legacy draft written while the old one decodes", async () => {
  const { tab } = browser();
  const client = tab();
  const storage = memoryStorage();
  const before = await legacyDraft("classic");
  const after = await legacyDraft("slim");
  storage.setItem(DRAFT_KEY, before);
  const getItem = storage.getItem;
  let changed = false;
  storage.getItem = (key) => {
    const value = getItem(key);
    if (key === DRAFT_KEY && !changed) {
      changed = true;
      storage.setItem(DRAFT_KEY, after);
    }
    return value;
  };
  assert.equal((await migrateLegacyDraft(client, storage)).status, "migrated");
  assert.equal(storage.getItem(DRAFT_KEY), after);
  let listing = await use(client, (library) => library.list);
  assert.equal(listing.skins.length, 1);
  assert.equal(listing.skins[0].current.variant, "classic");
  assert.equal((await migrateLegacyDraft(client, storage)).status, "migrated");
  assert.equal(storage.getItem(DRAFT_KEY), null);
  listing = await use(client, (library) => library.list);
  assert.equal(listing.skins.length, 2);
  assert.deepEqual(listing.skins.map((skin) => skin.current.variant).sort(), [
    "classic",
    "slim",
  ]);
});

test("a failed migration keeps the old draft, and damaged drafts stay", async () => {
  const full = browser();
  const storage = memoryStorage();
  storage.data.set(DRAFT_KEY, await legacyDraft());
  await failure(
    migrateLegacyDraft(full.tab(quotaFactory(full.factory)), storage),
  );
  assert.equal(storage.data.has(DRAFT_KEY), true);

  const { tab } = browser();
  const damaged = memoryStorage();
  damaged.data.set(DRAFT_KEY, "{not json");
  assert.equal((await migrateLegacyDraft(tab(), damaged)).status, "corrupt");
  assert.equal(damaged.data.get(DRAFT_KEY), "{not json");
  const newer = memoryStorage();
  newer.data.set(DRAFT_KEY, JSON.stringify({ version: 9 }));
  assert.equal((await migrateLegacyDraft(tab(), newer)).status, "newer");
  assert.equal(newer.data.has(DRAFT_KEY), true);
});

test("library work makes no network requests", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = Object.assign(() => {
    calls++;
    return Promise.reject(new Error("offline"));
  }, original);
  try {
    const { tab } = browser();
    const client = tab();
    const { skin } = await addSkin(client, await prepare(await skinPng(1)));
    await use(client, (library) => library.rename(skin.id, "Moss"));
    await use(client, (library) => library.duplicate(skin.id));
    await use(client, (library) => library.revert(skin.id));
    await use(client, (library) => library.remove(skin.id));
    await use(client, (library) => library.list);
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(calls, 0);
});

/** Wrap a factory so every write fails like a full disk. */
function quotaFactory(factory: IDBFactory): IDBFactory {
  return {
    open: (name: string, version?: number) => {
      const request = factory.open(name, version);
      const success = () => {
        const db = request.result;
        const transaction = db.transaction.bind(db);
        db.transaction = ((
          stores: string | string[],
          mode?: IDBTransactionMode,
          options?: IDBTransactionOptions,
        ) => {
          const tx = transaction(stores, mode, options);
          if (mode === "readwrite")
            queueMicrotask(() => {
              Object.defineProperty(tx, "error", {
                value: new DOMException("full", "QuotaExceededError"),
              });
              tx.abort();
            });
          return tx;
        }) as IDBDatabase["transaction"];
      };
      Object.defineProperty(request, "onsuccess", {
        set(handler: () => void) {
          request.addEventListener("success", () => {
            success();
            handler();
          });
        },
      });
      return request;
    },
  } as unknown as IDBFactory;
}
