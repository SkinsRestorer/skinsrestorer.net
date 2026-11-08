import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { Effect } from "effect";
import { IDBFactory } from "fake-indexeddb";
import { EditorSession, documentOf } from "./editor-session";
import { createTemplate, exportSkinPng, pixelOffset } from "./skin-document";
import { SkinEditorStore } from "./skin-editor-store";
import {
  createLibraryClient,
  withLibrary,
  type LibraryClient,
} from "./skin-library-client";
import {
  prepareSkinContent,
  skinLibraryLayer,
  type StoredSkin,
} from "./skin-library";

const disposers: (() => unknown)[] = [];
afterEach(async () => {
  for (const dispose of disposers.splice(0).reverse()) await dispose();
});

function tab(factory: IDBFactory) {
  const client = createLibraryClient(skinLibraryLayer({ factory }));
  disposers.push(() => client.dispose());
  return client;
}

function editor(library: LibraryClient | undefined) {
  const store = new SkinEditorStore();
  store.load(createTemplate("classic"));
  const session = new EditorSession(store, library, { saveDelayMs: 0 });
  disposers.push(() => session.dispose());
  return { store, session };
}

const paint = (store: SkinEditorStore, value: number) =>
  store.apply((_pixels, builder) =>
    builder.write(pixelOffset(9, 9) / 4, [value, 0, 0, 255]),
  );

async function keptSkin(library: LibraryClient, seed = 1) {
  const document = createTemplate("classic");
  document.pixels.set([seed, 0, 0, 255], pixelOffset(8, 8));
  const png = await exportSkinPng(document.pixels);
  const content = await Effect.runPromise(
    prepareSkinContent(new Blob([png as Uint8Array<ArrayBuffer>])),
  );
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
  assert.equal(listing.sessions[0].id, session.getSnapshot().sessionId);
  assert.equal(listing.sessions[0].baseRevision, skin.revision);
  assert.equal(listing.skins[0].revision, skin.revision);
  assert.deepEqual(
    await bytes(listing.skins[0].current.png),
    await bytes(skin.current.png),
  );
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
  const draft = listing.sessions[0];
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
  if (result.kind !== "saved") return;
  assert.equal(result.variant, "slim");
  assert.equal(result.skin?.id, skin.id);
  assert.equal(session.getSnapshot().dirty, false);
  const listing = await list(library);
  assert.equal(listing.sessions.length, 0);
  const saved = listing.skins[0];
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
  if (result.kind !== "saved") return;
  assert.notEqual(result.skin?.id, skin.id);
  assert.equal(result.name, "Harbor copy");
  assert.equal(result.skin?.source.copiedFrom, skin.id);
  const listing = await list(library);
  const source = listing.skins.find((entry) => entry.id === skin.id)!;
  assert.equal(source.revision, skin.revision);
  assert.equal(source.current.hash, skin.current.hash);
  assert.equal(listing.sessions.length, 0);
  // The editor now works on the copy.
  assert.equal(session.getSnapshot().target.skinId, result.skin?.id);
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
  await after.session.continueDraft(recovery[0]);
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
  if (conflict.kind !== "changed") return;
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

test("without a library, saving returns the edited PNG for the form only", async () => {
  const { store, session } = editor(undefined);
  session.start(createTemplate("classic"), { name: "harbor" });
  paint(store, 3);
  assert.equal(session.getSnapshot().drafts.kind, "off");
  const result = await session.save();
  assert.equal(result.kind, "saved");
  if (result.kind !== "saved") return;
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
  assert.equal(listing.skins[0].source.kind, "editor");
  assert.equal(session.getSnapshot().target.skinId, listing.skins[0].id);
});

test("when the library cannot open, saving returns the PNG without asking", async () => {
  const blocked = createLibraryClient(
    skinLibraryLayer({
      factory: {
        open: () => {
          throw new DOMException("blocked", "SecurityError");
        },
      } as unknown as IDBFactory,
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
  if (result.kind === "saved") assert.equal(result.skin, undefined);
});
