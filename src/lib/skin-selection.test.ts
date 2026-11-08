import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { IDBFactory } from "fake-indexeddb";
import type { SkinVariant } from "./skin";
import { createTemplate, exportSkinPng, pixelOffset } from "./skin-document";
import {
  createLibraryClient,
  withLibrary,
  type LibraryClient,
} from "./skin-library-client";
import { skinLibraryLayer } from "./skin-library";
import {
  sameGenerationInput,
  SkinSelectionStore,
  type PreviewEvents,
} from "./skin-selection";

const clients: LibraryClient[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.dispose()));
});

function library(factory = new IDBFactory()) {
  const client = createLibraryClient(skinLibraryLayer({ factory }));
  clients.push(client);
  return client;
}

/** A library whose calls never finish or always fail. */
const stalled: LibraryClient = {
  run: () => new Promise(() => undefined),
  subscribe: () => () => undefined,
  dispose: async () => undefined,
};
const failing: LibraryClient = {
  run: () =>
    Promise.reject(Object.assign(new Error("Browser storage is full."))),
  subscribe: () => () => undefined,
  dispose: async () => undefined,
};

async function skinFile(seed: number, name = `skin-${seed}.png`) {
  const document = createTemplate("classic");
  document.pixels.set([seed, 2, 3, 255], pixelOffset(8, 8));
  const png = await exportSkinPng(document.pixels);
  return new File([png as Uint8Array<ArrayBuffer>], name, {
    type: "image/png",
  });
}

/** Detection the test finishes by hand, in any order. */
function manualPreview() {
  const pending: {
    file: File;
    events: PreviewEvents;
    signal: AbortSignal;
  }[] = [];
  const waiting: (() => void)[] = [];
  return {
    pending,
    preview: (file: File, events: PreviewEvents, signal: AbortSignal) => {
      pending.push({ file, events, signal });
      for (const wake of waiting.splice(0)) wake();
      return new Promise<void>((_, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason)),
      );
    },
    async next(count = 1) {
      while (pending.length < count)
        await new Promise<void>((resolve) => waiting.push(resolve));
    },
  };
}

function autoPreview(variant: SkinVariant = "classic") {
  return (file: File, events: PreviewEvents, signal: AbortSignal) => {
    events.preview(`blob:${file.name}`);
    events.detected(variant);
    return new Promise<void>((_, reject) =>
      signal.addEventListener("abort", () => reject(signal.reason)),
    );
  };
}

async function until(check: () => boolean) {
  for (let i = 0; i < 200 && !check(); i++)
    await new Promise((resolve) => setTimeout(resolve, 1));
  assert.ok(check(), "condition not reached");
}

async function bytes(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

test("a dropped skin is selected without waiting for the library", async () => {
  const store = new SkinSelectionStore({
    preview: autoPreview("slim"),
    library: stalled,
  });
  const file = await skinFile(1);
  store.selectFiles([file]);
  // Selected at once, before any library work.
  assert.equal(store.getSnapshot().selection?.status, "checking");
  await until(() => store.getSnapshot().selection?.status === "ready");
  const { selection, variant } = store.getSnapshot();
  assert.equal(variant, "slim");
  assert.equal(selection?.keep.kind, "saving");
  // The form sends an in-memory copy with the exact dropped bytes.
  assert.notEqual(selection?.file, file);
  assert.deepEqual(await bytes(selection!.file), await bytes(file));
  store.dispose();
});

test("a failing library leaves the selection usable and says it was not kept", async () => {
  const store = new SkinSelectionStore({
    preview: autoPreview(),
    library: failing,
  });
  store.selectFiles([await skinFile(1)]);
  await until(() => store.getSnapshot().selection?.keep.kind === "off");
  const selection = store.getSnapshot().selection!;
  assert.equal(selection.status, "ready");
  assert.equal(selection.skinId, undefined);
  assert.equal(
    selection.keep.kind === "off" && selection.keep.message,
    "Browser storage is full.",
  );
  store.dispose();
});

test("a late detection result never replaces a newer file", async () => {
  const preview = manualPreview();
  const store = new SkinSelectionStore({ preview: preview.preview });
  store.selectFiles([await skinFile(1, "old.png")]);
  await preview.next(1);
  store.selectFiles([await skinFile(2, "new.png")]);
  await preview.next(2);
  const [old, next] = preview.pending;
  next.events.detected("slim");
  old.events.preview("blob:old");
  old.events.detected("classic");
  const { selection, variant, previewUrl } = store.getSnapshot();
  assert.equal(selection?.name, "new");
  assert.equal(variant, "slim");
  assert.equal(previewUrl, null);
  assert.equal(old.signal.aborted, true);
  store.dispose();
});

test("detection does not overwrite a model the user already picked", async () => {
  const preview = manualPreview();
  const store = new SkinSelectionStore({ preview: preview.preview });
  store.selectFiles([await skinFile(1)]);
  await preview.next();
  store.setVariant("slim");
  preview.pending[0].events.detected("classic");
  assert.equal(store.getSnapshot().variant, "slim");
  store.dispose();
});

test("an editor or handoff model wins over detection", async () => {
  const store = new SkinSelectionStore({ preview: autoPreview("classic") });
  store.select(await skinFile(1), { origin: "handoff", variant: "slim" });
  await until(() => store.getSnapshot().selection?.status === "ready");
  assert.equal(store.getSnapshot().variant, "slim");
  assert.equal(store.getSnapshot().selection?.origin, "handoff");
  store.dispose();
});

test("a late library write links only the selection that started it", async () => {
  const client = library();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const slow: LibraryClient = {
    ...client,
    run: async (effect, signal) => {
      await gate;
      return client.run(effect, signal);
    },
  };
  const store = new SkinSelectionStore({
    preview: autoPreview(),
    library: slow,
  });
  store.selectFiles([await skinFile(1, "first.png")]);
  await until(() => store.getSnapshot().selection?.status === "ready");
  store.selectFiles([await skinFile(2, "second.png")]);
  await until(() => store.getSnapshot().selection?.status === "ready");
  release();
  await until(() => store.getSnapshot().selection?.keep.kind === "kept");
  const listing = await client.run(withLibrary((l) => l.list));
  const second = listing.skins.find((skin) => skin.name === "second")!;
  assert.equal(listing.skins.length, 2);
  assert.equal(store.getSnapshot().selection?.skinId, second.id);
  store.dispose();
});

test("a model picked while the skin is kept is saved to the skin", async () => {
  const client = library();
  const store = new SkinSelectionStore({
    preview: autoPreview(),
    library: client,
  });
  store.selectFiles([await skinFile(1)]);
  await until(() => store.getSnapshot().selection?.status === "ready");
  store.setVariant("slim");
  await until(() => store.getSnapshot().selection?.keep.kind === "kept");
  await until(() => (store.getSnapshot().selection?.revision ?? 0) > 1);
  const skin = await client.run(
    withLibrary((l) => l.get(store.getSnapshot().selection!.skinId!)),
  );
  assert.equal(skin.current.variant, "slim");
  assert.equal(skin.original.variant, "classic");
  store.dispose();
});

test("multi-file drops keep every valid skin but select only the first", async () => {
  const client = library();
  const imported: [number, number][] = [];
  const store = new SkinSelectionStore({
    preview: autoPreview(),
    library: client,
    events: { imported: (kept, failed) => imported.push([kept, failed]) },
  });
  store.selectFiles([
    await skinFile(1, "a.png"),
    await skinFile(2, "b.png"),
    new File(["not a png"], "c.png", { type: "image/png" }),
  ]);
  await until(() => imported.length === 1);
  await until(() => store.getSnapshot().selection?.keep.kind === "kept");
  assert.deepEqual(imported, [[2, 1]]);
  assert.equal(store.getSnapshot().selection?.name, "a");
  const listing = await client.run(withLibrary((l) => l.list));
  assert.deepEqual(listing.skins.map((skin) => skin.name).sort(), ["a", "b"]);
  store.dispose();
});

test("a change in another tab is offered, never swapped into the form", async () => {
  const factory = new IDBFactory();
  const tabA = library(factory);
  const tabB = library(factory);
  const store = new SkinSelectionStore({
    preview: autoPreview(),
    library: tabA,
  });
  store.selectFiles([await skinFile(1)]);
  await until(() => store.getSnapshot().selection?.keep.kind === "kept");
  const selected = store.getSnapshot().selection!;
  await tabB.run(withLibrary((l) => l.setVariant(selected.skinId!, "slim")));
  store.refresh();
  await until(() => store.getSnapshot().selection?.keep.kind === "changed");
  // The form still shows and sends the snapshot it had.
  assert.equal(store.getSnapshot().selection?.file, selected.file);
  assert.equal(store.getSnapshot().variant, "classic");
  store.useLatest();
  await until(() => store.getSnapshot().selection?.status === "ready");
  assert.equal(store.getSnapshot().variant, "slim");
  assert.equal(store.getSnapshot().selection?.origin, "library");

  await tabB.run(
    withLibrary((l) => l.remove(store.getSnapshot().selection!.skinId!)),
  );
  store.refresh();
  await until(() => store.getSnapshot().selection?.keep.kind === "removed");
  assert.equal(store.getSnapshot().selection?.status, "ready");
  store.dispose();
});

test("a skin selected from the library is the stored current version", async () => {
  const client = library();
  const keep = new SkinSelectionStore({
    preview: autoPreview(),
    library: client,
  });
  keep.selectFiles([await skinFile(5, "moss.png")]);
  await until(() => keep.getSnapshot().selection?.keep.kind === "kept");
  keep.dispose();
  const [skin] = (await client.run(withLibrary((l) => l.list))).skins;
  const store = new SkinSelectionStore({
    preview: autoPreview("classic"),
    library: client,
  });
  store.selectSkin({ ...skin, current: { ...skin.current, variant: "slim" } });
  await until(() => store.getSnapshot().selection?.status === "ready");
  const selection = store.getSnapshot().selection!;
  assert.equal(selection.skinId, skin.id);
  assert.equal(selection.keep.kind, "kept");
  assert.equal(store.getSnapshot().variant, "slim");
  assert.deepEqual(await bytes(selection.file), await bytes(skin.current.png));
  store.dispose();
});

test("a generation result belongs to the exact snapshot and options", async () => {
  const file = await skinFile(1);
  const input = {
    file,
    variant: "classic" as const,
    method: "axolotl",
    capeUuid: "none",
    name: "",
  };
  assert.equal(sameGenerationInput(input, { ...input }), true);
  for (const change of [
    { file: new File([file], file.name) },
    { variant: "slim" as const },
    { method: "mineskin" },
    { capeUuid: "cape" },
    { name: "lobby" },
  ])
    assert.equal(sameGenerationInput(input, { ...input, ...change }), false);
});
