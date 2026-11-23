import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { Effect } from "effect";
import { IDBFactory } from "fake-indexeddb";
import {
  EditorSession,
  documentOf,
  type Schedule,
  type SessionLocks,
} from "./editor-session";
import type { Locale } from "./i18n";
import { createTemplate, exportSkinPng, pixelOffset } from "./skin-document";
import { SkinEditorStore } from "./skin-editor-store";
import {
  allPartsVisible,
  defaultBrush,
  type PaintSettings,
} from "./skin-paint";
import {
  createLibraryClient,
  withLibrary,
  type LibraryClient,
} from "./skin-library-client";
import {
  libraryError,
  prepareSkinContent,
  skinLibraryLayer,
  type StoredSkin,
} from "./skin-library";
import { required } from "./utils";

const disposers: (() => unknown)[] = [];
afterEach(async () => {
  for (const dispose of disposers.splice(0).toReversed()) await dispose();
});

function tab(factory: IDBFactory) {
  const client = createLibraryClient(skinLibraryLayer({ factory }));
  disposers.push(() => client.dispose());
  return client;
}

/** Timers that run only when a test moves time forward. */
function manualTimers() {
  let now = 0;
  const pending = new Map<number, { at: number; callback: () => void }>();
  let ids = 0;
  const schedule: Schedule = (callback, ms) => {
    const id = ++ids;
    pending.set(id, { at: now + ms, callback });
    return () => {
      pending.delete(id);
    };
  };
  const advance = (ms: number) => {
    now += ms;
    for (const [id, timer] of pending)
      if (timer.at <= now) {
        pending.delete(id);
        timer.callback();
      }
  };
  return { schedule, advance, pending: () => pending.size };
}

function editor(
  library: LibraryClient | undefined,
  saveDelayMs = 0,
  locale?: Locale,
  locks?: SessionLocks,
  schedule?: Schedule,
) {
  const store = new SkinEditorStore();
  store.load(createTemplate("classic"));
  const session = new EditorSession(store, library, {
    saveDelayMs,
    locale: locale === undefined ? undefined : () => locale,
    locks,
    ...(schedule ? { schedule } : {}),
  });
  disposers.push(() => session.dispose());
  return { store, session };
}

/** A client that counts its draft writes. */
function counting(real: LibraryClient) {
  const count = { writes: 0 };
  const client: LibraryClient = {
    ...real,
    run: (effect, signal) => {
      count.writes++;
      return real.run(effect, signal);
    },
  };
  return { client, count };
}

const paint = (store: SkinEditorStore, value: number) =>
  store.apply((_pixels, builder) => {
    builder.write(pixelOffset(9, 9) / 4, [value, 0, 0, 255]);
  });

async function keptSkin(library: LibraryClient, seed = 1) {
  const document = createTemplate("classic");
  document.pixels.set([seed, 0, 0, 255], pixelOffset(8, 8));
  const png = await exportSkinPng(document.pixels);
  const content = await Effect.runPromise(prepareSkinContent(new Blob([png])));
  const { skin } = await library.run(
    withLibrary((l) =>
      l.add(
        { name: "Harbor", content, source: { kind: "file" } },
        { dedupe: false },
      ),
    ),
  );
  return skin;
}

async function open(session: EditorSession, skin: StoredSkin) {
  session.start(await documentOf(skin.current.png, skin.current.variant), {
    skinId: skin.id,
    baseRevision: skin.revision,
    name: skin.name,
  });
}

/** Let settled promise callbacks, such as a lock release, run. */
const settle = () =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

const pencil: PaintSettings = {
  ...defaultBrush,
  layer: "base",
  color: [10, 20, 30, 255],
  visibility: allPartsVisible(),
};

const list = (library: LibraryClient) =>
  library.run(withLibrary((l) => l.list));

async function bytes(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

test("autosave writes only the editor's own draft, never the skin", async () => {
  const library = tab(new IDBFactory());
  const skin = await keptSkin(library);
  const { store, session } = editor(library);
  await open(session, skin);
  assert.equal(session.getSnapshot().dirty, false);
  paint(store, 200);
  assert.equal(session.getSnapshot().dirty, true);
  await session.flush();
  const listing = await list(library);
  assert.equal(listing.sessions.length, 1);
  assert.equal(listing.sessions[0]?.id, session.getSnapshot().sessionId);
  assert.equal(listing.sessions[0].baseRevision, skin.revision);
  assert.equal(listing.skins[0]?.revision, skin.revision);
  assert.deepEqual(
    await bytes(listing.skins[0].current.png),
    await bytes(skin.current.png),
  );
});

test("autosave waits for a quiet moment and never writes during a stroke", async () => {
  const real = tab(new IDBFactory());
  const { client, count } = counting(real);
  const timers = manualTimers();
  const { store, session } = editor(
    client,
    30,
    undefined,
    undefined,
    timers.schedule,
  );
  paint(store, 10);
  timers.advance(29);
  assert.equal(count.writes, 0);
  // A stroke cancels the scheduled write until the stroke ends.
  store.beginStroke("pencil", pencil, 8, 8);
  store.strokeTo(12, 8);
  assert.equal(timers.pending(), 0);
  timers.advance(60);
  assert.equal(count.writes, 0);
  store.endStroke();
  timers.advance(29);
  assert.equal(count.writes, 0);
  timers.advance(1);
  // The scheduled write runs; a flush queued after it waits for it.
  await session.flush();
  assert.equal(count.writes, 2);
  const listing = await list(real);
  assert.equal(listing.sessions.length, 1);
  assert.equal(listing.sessions[0]?.id, session.getSnapshot().sessionId);
});

test("an explicit flush replaces the scheduled write and resolves after it", async () => {
  const library = tab(new IDBFactory());
  const timers = manualTimers();
  const { store, session } = editor(
    library,
    30,
    undefined,
    undefined,
    timers.schedule,
  );
  paint(store, 11);
  assert.equal(timers.pending(), 1);
  assert.equal(await session.flush(), true);
  assert.equal((await list(library)).sessions.length, 1);
  // The schedule is cancelled, so it cannot write a second time.
  assert.equal(timers.pending(), 0);
});

test("discard cancels a scheduled autosave so the draft does not come back", async () => {
  const library = tab(new IDBFactory());
  const timers = manualTimers();
  const { store, session } = editor(
    library,
    20,
    undefined,
    undefined,
    timers.schedule,
  );
  paint(store, 12);
  await session.flush();
  paint(store, 13);
  await session.discard();
  timers.advance(50);
  await session.flush();
  assert.equal((await list(library)).sessions.length, 0);
  assert.equal(session.getSnapshot().dirty, false);
});

test("dispose writes pending work and resolves after the write", async () => {
  const library = tab(new IDBFactory());
  const timers = manualTimers();
  const store = new SkinEditorStore();
  store.load(createTemplate("classic"));
  const session = new EditorSession(store, library, {
    saveDelayMs: 10_000,
    schedule: timers.schedule,
  });
  paint(store, 14);
  await session.dispose();
  assert.equal((await list(library)).sessions.length, 1);
  // The store no longer schedules writes for this session.
  paint(store, 15);
  assert.equal(timers.pending(), 0);
});

test("a queued draft keeps its pixels and owner when another skin opens", async () => {
  const library = tab(new IDBFactory());
  const skin = await keptSkin(library);
  const { store, session } = editor(library);
  await open(session, skin);
  paint(store, 201);
  store.setVariant("slim");
  const previous = store.document();
  const previousId = session.getSnapshot().sessionId;
  const saving = session.flush();
  session.start(createTemplate("classic"), { name: "Next skin" });
  await saving;
  const listing = await list(library);
  assert.equal(listing.sessions.length, 1);
  const draft = required(listing.sessions[0], "saved draft");
  assert.equal(draft.id, previousId);
  assert.equal(draft.skinId, skin.id);
  assert.equal(draft.variant, "slim");
  assert.deepEqual(
    (await documentOf(draft.png, draft.variant)).pixels,
    previous.pixels,
  );
  assert.equal(session.getSnapshot().dirty, false);
});

test("a queued autosave does not recreate a draft after saving the skin", async () => {
  const library = tab(new IDBFactory());
  const skin = await keptSkin(library);
  const { store, session } = editor(library);
  await open(session, skin);
  paint(store, 202);
  const saving = session.save();
  const autosaving = session.flush();
  assert.equal((await saving).kind, "saved");
  await autosaving;
  assert.equal((await list(library)).sessions.length, 0);
});

test("save replaces the current version, keeps the original, and ends the draft", async () => {
  const library = tab(new IDBFactory());
  const skin = await keptSkin(library);
  const { store, session } = editor(library);
  await open(session, skin);
  paint(store, 200);
  store.setVariant("slim");
  await session.flush();
  const result = await session.save();
  assert.equal(result.kind, "saved");
  assert.equal(result.variant, "slim");
  assert.equal(result.skin?.id, skin.id);
  assert.equal(session.getSnapshot().dirty, false);
  const listing = await list(library);
  assert.equal(listing.sessions.length, 0);
  const saved = required(listing.skins[0], "saved skin");
  assert.equal(saved.current.variant, "slim");
  assert.equal(saved.original.hash, skin.original.hash);
  assert.deepEqual(await bytes(result.file), await bytes(saved.current.png));
  // Later saves start from the new revision.
  paint(store, 10);
  assert.equal((await session.save()).kind, "saved");
});

test("save as copy selects a new skin and leaves the source unchanged", async () => {
  const library = tab(new IDBFactory());
  const skin = await keptSkin(library);
  const { store, session } = editor(library);
  await open(session, skin);
  paint(store, 99);
  await session.flush();
  const result = await session.saveCopy();
  assert.equal(result.kind, "saved");
  assert.notEqual(result.skin?.id, skin.id);
  assert.equal(result.name, "Harbor copy");
  assert.equal(result.skin?.source.copiedFrom, skin.id);
  const listing = await list(library);
  const source = required(
    listing.skins.find((entry) => entry.id === skin.id),
    "find result",
  );
  assert.equal(source.revision, skin.revision);
  assert.equal(source.current.hash, skin.current.hash);
  assert.equal(listing.sessions.length, 0);
  // The editor now works on the copy.
  assert.equal(session.getSnapshot().target.skinId, result.skin.id);
});

test("an unsaved draft survives a reload and continues in a new session", async () => {
  const factory = new IDBFactory();
  const first = tab(factory);
  const skin = await keptSkin(first);
  const before = editor(first);
  await open(before.session, skin);
  before.store.setVariant("slim");
  paint(before.store, 77);
  await before.session.flush();
  const pixels = before.store.pixels.slice();
  const oldId = before.session.getSnapshot().sessionId;

  // After a reload, a new editor finds the draft for this skin.
  const reloaded = tab(factory);
  const after = editor(reloaded);
  await open(after.session, skin);
  const recovery = await after.session.loadRecovery({ skinId: skin.id });
  assert.deepEqual(
    recovery.map((draft) => draft.id),
    [oldId],
  );
  await after.session.continueDraft(required(recovery[0], "recovered draft"));
  assert.deepEqual(after.store.pixels, pixels);
  assert.equal(after.store.getSnapshot().variant, "slim");
  assert.equal(after.session.getSnapshot().dirty, true);
  const listing = await list(reloaded);
  assert.deepEqual(
    listing.sessions.map((session) => session.id),
    [after.session.getSnapshot().sessionId],
  );
  // Discard returns to the saved skin, not to the draft.
  await after.session.discard();
  assert.equal(after.store.getSnapshot().variant, "classic");
  assert.equal((await list(reloaded)).sessions.length, 0);
});

test("two editors on one skin keep both drafts and the second save conflicts", async () => {
  const factory = new IDBFactory();
  const tabA = tab(factory);
  const tabB = tab(factory);
  const skin = await keptSkin(tabA);
  const a = editor(tabA);
  const b = editor(tabB);
  await open(a.session, skin);
  await open(b.session, skin);
  paint(a.store, 1);
  b.store.setVariant("slim");
  await Promise.all([a.session.flush(), b.session.flush()]);
  assert.equal((await list(tabA)).sessions.length, 2);

  // B changes only the model, then A tries to save pixels.
  assert.equal((await b.session.save()).kind, "saved");
  const conflict = await a.session.save();
  assert.equal(conflict.kind, "changed");
  assert.equal(conflict.skin.current.variant, "slim");
  // A's draft is still there; nothing was lost.
  assert.equal((await list(tabA)).sessions.length, 1);
  const copy = await a.session.saveCopy();
  assert.equal(copy.kind, "saved");
  const listing = await list(tabA);
  assert.equal(listing.skins.length, 2);
  assert.equal(listing.sessions.length, 0);
});

test("a skin removed while editing can still be saved as a copy", async () => {
  const factory = new IDBFactory();
  const tabA = tab(factory);
  const tabB = tab(factory);
  const skin = await keptSkin(tabA);
  const { store, session } = editor(tabA);
  await open(session, skin);
  paint(store, 5);
  await session.flush();
  await tabB.run(withLibrary((l) => l.remove(skin.id)));
  assert.equal((await session.save()).kind, "removed");
  const copy = await session.saveCopy();
  assert.equal(copy.kind, "saved");
  assert.equal((await list(tabA)).skins.length, 1);
});

test("save as copy names the copy in the visitor's language", async () => {
  const library = tab(new IDBFactory());
  const skin = await keptSkin(library);
  const { store, session } = editor(library, 0, "ru");
  await open(session, skin);
  paint(store, 4);
  const result = await session.saveCopy();
  assert.equal(result.kind, "saved");
  assert.equal(result.name, "Harbor (копия)");
  assert.equal(result.file.name, "Harbor (копия).png");
});

test("a draft written after another tab removed its skin can become a new skin", async () => {
  const factory = new IDBFactory();
  const tabA = tab(factory);
  const tabB = tab(factory);
  const skin = await keptSkin(tabA);
  // Tab B removes the skin, then tab A's next autosave writes a draft for it.
  const a = editor(tabA);
  await open(a.session, skin);
  await tabB.run(withLibrary((l) => l.remove(skin.id)));
  paint(a.store, 6);
  await a.session.flush();

  const reloaded = editor(tab(factory));
  const recovery = await reloaded.session.loadRecovery();
  assert.equal(recovery.length, 1);
  assert.deepEqual(reloaded.session.getSnapshot().orphans, [recovery[0]?.id]);
  const saved = await reloaded.session.saveDraftAsSkin(
    required(recovery[0], "recovered draft"),
  );
  assert.equal(saved?.name, "Harbor");
  assert.notEqual(saved.id, skin.id);
  assert.deepEqual(reloaded.session.getSnapshot().recovery, []);
  assert.deepEqual(reloaded.session.getSnapshot().orphans, []);
  const listing = await list(tabA);
  assert.deepEqual(
    listing.skins.map((entry) => entry.id),
    [saved.id],
  );
  // The draft became the skin, so it is no longer offered for recovery.
  assert.equal(listing.sessions.length, 0);
});

test("continuing a draft whose skin was removed saves it as a new skin", async () => {
  const factory = new IDBFactory();
  const tabA = tab(factory);
  const skin = await keptSkin(tabA);
  const a = editor(tabA);
  await open(a.session, skin);
  await tabA.run(withLibrary((l) => l.remove(skin.id)));
  paint(a.store, 8);
  await a.session.flush();

  const library = tab(factory);
  const b = editor(library);
  const [draft] = await b.session.loadRecovery();
  await b.session.continueDraft(required(draft, "recovered draft"));
  assert.equal(b.session.getSnapshot().target.skinId, undefined);
  assert.equal(b.session.getSnapshot().target.name, "Harbor");
  // The continued draft no longer points at the removed skin.
  const continued = (await list(library)).sessions.find(
    (entry) => entry.id === b.session.getSnapshot().sessionId,
  );
  assert.equal(continued?.skinId, undefined);
  const result = await b.session.save();
  assert.equal(result.kind, "saved");
  assert.notEqual(result.skin?.id, skin.id);
  assert.equal(result.skin?.name, "Harbor");
});

test("without a library, saving returns the edited PNG for the form only", async () => {
  const { store, session } = editor(undefined);
  session.start(createTemplate("classic"), { name: "harbor" });
  paint(store, 3);
  assert.equal(session.getSnapshot().drafts.kind, "off");
  const result = await session.save();
  assert.equal(result.kind, "saved");
  assert.equal(result.skin, undefined);
  assert.equal(result.file.name, "harbor.png");
  const reopened = await documentOf(result.file, result.variant);
  assert.deepEqual(reopened.pixels, store.pixels);
});

test("new work is saved as a new skin on the first save", async () => {
  const library = tab(new IDBFactory());
  const { store, session } = editor(library);
  session.start(createTemplate("slim"), { name: "New skin" });
  paint(store, 8);
  const result = await session.save();
  assert.equal(result.kind, "saved");
  const listing = await list(library);
  assert.equal(listing.skins.length, 1);
  assert.equal(listing.skins[0]?.source.kind, "editor");
  assert.equal(session.getSnapshot().target.skinId, listing.skins[0].id);
});

test("when the library cannot open, saving returns the PNG without asking", async () => {
  const blocked = createLibraryClient(
    skinLibraryLayer({
      factory: {
        open: () => {
          throw new DOMException("blocked", "SecurityError");
        },
      },
    }),
  );
  disposers.push(() => blocked.dispose());
  const { store, session } = editor(blocked);
  session.start(createTemplate("classic"), { name: "harbor" });
  await session.loadRecovery();
  assert.equal(session.getSnapshot().drafts.kind, "off");
  paint(store, 4);
  const result = await session.save();
  assert.equal(result.kind, "saved");
  assert.equal(result.skin, undefined);
});

test("drafts come back after a full storage write, and stop when the library cannot open", async () => {
  const real = tab(new IDBFactory());
  let failWith: "full" | "unavailable" | undefined = "full";
  const flaky: LibraryClient = {
    ...real,
    run: (effect, signal) =>
      failWith
        ? Promise.reject(libraryError(failWith))
        : real.run(effect, signal),
  };
  const { store, session } = editor(flaky);
  paint(store, 1);
  // The caller learns that the work is not kept, for example to stay open.
  assert.equal(await session.flush(), false);
  assert.equal(session.getSnapshot().drafts.kind, "off");
  // The user frees space; the next change writes the draft again.
  failWith = undefined;
  paint(store, 2);
  assert.equal(await session.flush(), true);
  assert.equal(session.getSnapshot().drafts.kind, "saved");
  assert.equal((await list(real)).sessions.length, 1);

  failWith = "unavailable";
  paint(store, 3);
  await session.flush();
  assert.equal(session.getSnapshot().drafts.kind, "off");
  failWith = undefined;
  paint(store, 4);
  await session.flush();
  assert.equal(session.getSnapshot().drafts.kind, "off");
});

/** Web Locks shared by the tabs of one browser. */
function browserLocks(): SessionLocks {
  const held = new Set<string>();
  return {
    request: (name, callback) => {
      held.add(name);
      return callback().finally(() => {
        held.delete(name);
      });
    },
    query: () =>
      Promise.resolve({
        held: [...held].map((name) => ({ name, mode: "exclusive" as const })),
        pending: [],
      }),
  };
}

/** A client that can fail its next calls with a storage error. */
function failing(real: LibraryClient) {
  const control = { fail: false, runs: 0 };
  const client: LibraryClient = {
    ...real,
    run: (effect, signal) => {
      control.runs++;
      return control.fail
        ? Promise.reject(libraryError("full"))
        : real.run(effect, signal);
    },
  };
  return { client, control };
}

test("a page-hide flush starts its write at once and wins over an older queued write", async () => {
  const real = tab(new IDBFactory());
  // The library is open, so a write starts without waiting.
  await list(real);
  const { client, control } = failing(real);
  const { store, session } = editor(client, 10_000);
  paint(store, 1);
  assert.equal(session.getSnapshot().drafts.kind, "idle");
  const queued = session.flush();
  paint(store, 2);
  const runs = control.runs;
  const hidden = session.flushNow();
  assert.equal(control.runs, runs + 1);
  await Promise.all([queued, hidden]);
  assert.equal(session.getSnapshot().drafts.kind, "saved");
  const [draft] = (await list(real)).sessions;
  const kept = await documentOf(
    required(draft, "draft").png,
    required(draft, "draft").variant,
  );
  assert.deepEqual(kept.pixels, store.pixels);
  // New work has no draft yet.
  session.start(createTemplate("slim"), { name: "Other" });
  assert.equal(session.getSnapshot().drafts.kind, "idle");
});

test("recovery leaves out drafts that an open editor in another tab owns", async () => {
  const factory = new IDBFactory();
  const locks = browserLocks();
  const a = editor(tab(factory), 0, undefined, locks);
  paint(a.store, 3);
  await a.session.flush();
  const draftId = a.session.getSnapshot().sessionId;

  const b = editor(tab(factory), 0, undefined, locks);
  assert.deepEqual(await b.session.loadRecovery(), []);
  // Tab A closes; its draft can now be continued.
  await a.session.dispose();
  await settle();
  assert.deepEqual(
    (await b.session.loadRecovery()).map((draft) => draft.id),
    [draftId],
  );
});

test("continuing a draft that is gone drops it from the list", async () => {
  const factory = new IDBFactory();
  const a = editor(tab(factory));
  paint(a.store, 4);
  await a.session.flush();
  await a.session.dispose();

  const bLibrary = tab(factory);
  const b = editor(bLibrary);
  const c = editor(tab(factory));
  const [draft] = await b.session.loadRecovery();
  await c.session.loadRecovery();
  const recovered = required(draft, "recovered draft");
  // A double click continues the draft once. The second click finds the
  // editor already working on the continued draft and leaves it alone.
  const results = await Promise.all([
    b.session.continueDraft(recovered),
    b.session.continueDraft(recovered),
  ]);
  assert.deepEqual(results.toSorted(), ["continued", "superseded"]);
  assert.deepEqual(
    (await list(bLibrary)).sessions.map((entry) => entry.id),
    [b.session.getSnapshot().sessionId],
  );
  // Another tab still lists the draft, but it is gone.
  assert.equal(await c.session.continueDraft(recovered), "missing");
  assert.deepEqual(c.session.getSnapshot().recovery, []);
});

test("a discarded draft leaves the list only after the delete, and undo brings it back", async () => {
  const factory = new IDBFactory();
  const a = editor(tab(factory));
  paint(a.store, 5);
  await a.session.flush();
  await a.session.dispose();

  const real = tab(factory);
  const { client, control } = failing(real);
  const b = editor(client);
  const [draft] = await b.session.loadRecovery();
  const recovered = required(draft, "recovered draft");
  control.fail = true;
  await assert.rejects(b.session.discardDraft(recovered));
  assert.deepEqual(
    b.session.getSnapshot().recovery.map((entry) => entry.id),
    [recovered.id],
  );
  control.fail = false;
  await b.session.discardDraft(recovered);
  assert.deepEqual(b.session.getSnapshot().recovery, []);
  assert.equal((await list(real)).sessions.length, 0);
  await b.session.restoreDraft(recovered);
  assert.deepEqual(
    b.session.getSnapshot().recovery.map((entry) => entry.id),
    [recovered.id],
  );
});

/** A client whose calls wait while the gate is closed. */
function gated(real: LibraryClient) {
  let wait: Promise<void> | undefined;
  let release: (() => void) | undefined;
  const client: LibraryClient = {
    ...real,
    run: async (effect, signal) => {
      await wait;
      return real.run(effect, signal);
    },
  };
  return {
    client,
    close: () => {
      wait = new Promise((resolve) => {
        release = resolve;
      });
    },
    open: () => {
      wait = undefined;
      release?.();
    },
  };
}

const ids = (drafts: readonly { readonly id: string }[]) =>
  drafts.map((draft) => draft.id);

test("a closing editor keeps its lock until its last draft write ends", async () => {
  const factory = new IDBFactory();
  const locks = browserLocks();
  const gate = gated(tab(factory));
  const a = editor(gate.client, 0, undefined, locks);
  paint(a.store, 7);
  await a.session.flush();
  const id = a.session.getSnapshot().sessionId;
  paint(a.store, 8);
  gate.close();
  const disposing = a.session.dispose();
  await settle();
  // The older draft exists, but a newer write of it is still pending.
  const b = editor(tab(factory), 0, undefined, locks);
  assert.deepEqual(await b.session.loadRecovery(), []);
  gate.open();
  await disposing;
  await settle();
  assert.deepEqual(ids(await b.session.loadRecovery()), [id]);
});

test("other work keeps the old session's lock until its queued write ends", async () => {
  const factory = new IDBFactory();
  const locks = browserLocks();
  const gate = gated(tab(factory));
  const a = editor(gate.client, 0, undefined, locks);
  paint(a.store, 9);
  await a.session.flush();
  const id = a.session.getSnapshot().sessionId;
  paint(a.store, 10);
  gate.close();
  const writing = a.session.flush();
  a.session.start(createTemplate("slim"), { name: "Next skin" });
  await settle();
  const b = editor(tab(factory), 0, undefined, locks);
  assert.deepEqual(await b.session.loadRecovery(), []);
  gate.open();
  assert.equal(await writing, true);
  await settle();
  assert.deepEqual(ids(await b.session.loadRecovery()), [id]);
});

test("a discarded session keeps its lock until its draft is deleted", async () => {
  const factory = new IDBFactory();
  const locks = browserLocks();
  const gate = gated(tab(factory));
  const a = editor(gate.client, 0, undefined, locks);
  paint(a.store, 11);
  await a.session.flush();
  gate.close();
  const discarding = a.session.discard();
  await settle();
  // Another tab must not continue a draft that is about to be deleted.
  const b = editor(tab(factory), 0, undefined, locks);
  assert.deepEqual(await b.session.loadRecovery(), []);
  gate.open();
  await discarding;
  await settle();
  assert.deepEqual(await b.session.loadRecovery(), []);
  assert.equal((await list(tab(factory))).sessions.length, 0);
});

test("a failed recovery read is shown and does not stop drafts", async () => {
  const real = tab(new IDBFactory());
  const { client, control } = failing(real);
  const { store, session } = editor(client);
  control.fail = true;
  assert.deepEqual(await session.loadRecovery(), []);
  assert.ok(session.getSnapshot().recoveryError);
  assert.equal(session.getSnapshot().drafts.kind, "idle");
  control.fail = false;
  paint(store, 12);
  assert.equal(await session.flush(), true);
  assert.equal(session.getSnapshot().drafts.kind, "saved");
  await session.loadRecovery();
  assert.equal(session.getSnapshot().recoveryError, undefined);
});

test("continuing a draft leaves new work alone when the editor moved on", async () => {
  const factory = new IDBFactory();
  const a = editor(tab(factory));
  paint(a.store, 13);
  await a.session.flush();
  await a.session.dispose();

  const library = tab(factory);
  const b = editor(library);
  const [draft] = await b.session.loadRecovery();
  const recovered = required(draft, "recovered draft");
  const continuing = b.session.continueDraft(recovered);
  // The user chooses Create skin while the draft is read.
  b.session.start(createTemplate("slim"), { name: "Fresh" });
  paint(b.store, 14);
  assert.equal(await continuing, "superseded");
  assert.equal(b.session.getSnapshot().target.name, "Fresh");
  assert.equal(b.store.getSnapshot().variant, "slim");
  assert.equal(b.session.getSnapshot().dirty, true);
  // The draft is untouched and still offered.
  assert.deepEqual(ids((await list(library)).sessions), [recovered.id]);
});

test("a draft kept on close is offered once its lock is free", async () => {
  const locks = browserLocks();
  const { store, session } = editor(tab(new IDBFactory()), 0, undefined, locks);
  assert.deepEqual(await session.loadRecovery(), []);
  paint(store, 15);
  assert.equal(await session.flush(), true);
  const kept = session.getSnapshot().sessionId;
  // Closing the editor starts a new session; the old draft stays.
  session.start(createTemplate("classic"), { name: "New skin" });
  // No one asks again: the session reads the list once the lock is free.
  await new Promise<void>((resolve) => {
    const stop = session.subscribe(() => {
      if (session.getSnapshot().recovery.length === 0) return;
      stop();
      resolve();
    });
  });
  assert.deepEqual(ids(session.getSnapshot().recovery), [kept]);
});

test("other tabs never offer a draft while it moves to the editor that continues it", async () => {
  const factory = new IDBFactory();
  const locks = browserLocks();
  const a = editor(tab(factory), 0, undefined, locks);
  paint(a.store, 16);
  await a.session.flush();
  await a.session.dispose();
  await settle();

  const c = editor(tab(factory), 0, undefined, locks);
  const real = tab(factory);
  const seen: string[][] = [];
  // Tab C reads the list right after the move commits, before tab B
  // opens the moved draft.
  const client: LibraryClient = {
    ...real,
    run: async (effect, signal) => {
      const result = await real.run(effect, signal);
      seen.push(ids(await c.session.loadRecovery()));
      return result;
    },
  };
  const b = editor(client, 0, undefined, locks);
  const [draft] = await real
    .run(withLibrary((l) => l.list))
    .then((listing) => listing.sessions);
  assert.equal(
    await b.session.continueDraft(required(draft, "draft")),
    "continued",
  );
  assert.deepEqual(seen.at(-1), []);
});

test("saving a draft as a skin creates nothing when the draft is gone", async () => {
  const factory = new IDBFactory();
  const a = editor(tab(factory));
  paint(a.store, 17);
  await a.session.flush();
  await a.session.dispose();

  const library = tab(factory);
  const b = editor(library);
  const c = editor(tab(factory));
  const [draft] = await b.session.loadRecovery();
  const recovered = required(draft, "recovered draft");
  await c.session.loadRecovery();
  // Tab B continues the draft; tab C still lists it.
  assert.equal(await b.session.continueDraft(recovered), "continued");
  assert.equal(await c.session.saveDraftAsSkin(recovered), undefined);
  assert.deepEqual(c.session.getSnapshot().recovery, []);
  assert.equal((await list(library)).skins.length, 0);
});

test("a draft queued during a save belongs to the saved skin", async () => {
  const library = tab(new IDBFactory());
  const { store, session } = editor(library, 10_000);
  paint(store, 18);
  const saving = session.save();
  // The user paints on while the new skin is saved.
  paint(store, 19);
  const writing = session.flush();
  const result = await saving;
  assert.equal(await writing, true);
  assert.equal(result.kind, "saved");
  const skin = required(result.skin, "skin");
  const [draft] = (await list(library)).sessions;
  assert.equal(required(draft, "draft").skinId, skin.id);
  assert.equal(required(draft, "draft").baseRevision, skin.revision);
});
