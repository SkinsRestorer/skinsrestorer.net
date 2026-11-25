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
import { required } from "./utils";

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
  run: () => new Promise(() => {}),
  subscribe: () => () => {},
  dispose: () => Promise.resolve(),
};
const failing: LibraryClient = {
  run: () => Promise.reject(new Error("Browser storage is full.")),
  subscribe: () => () => {},
  dispose: () => Promise.resolve(),
};

async function skinFile(seed: number, name = `skin-${seed}.png`) {
  const document = createTemplate("classic");
  document.pixels.set([seed, 2, 3, 255], pixelOffset(8, 8));
  const png = await exportSkinPng(document.pixels);
  return new File([png], name, {
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
      return new Promise<void>((_, reject) => {
        signal.addEventListener("abort", () => {
          // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- an abort reason is typed any; the signal rejects with its DOMException
          reject(signal.reason);
        });
      });
    },
    async next(count = 1) {
      while (pending.length < count)
        await new Promise<void>((resolve) => {
          waiting.push(resolve);
        });
    },
  };
}

function autoPreview(variant: SkinVariant = "classic") {
  return (file: File, events: PreviewEvents, signal: AbortSignal) => {
    events.preview(`blob:${file.name}`);
    events.detected(variant);
    return new Promise<void>((_, reject) => {
      signal.addEventListener("abort", () => {
        // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- an abort reason is typed any; the signal rejects with its DOMException
        reject(signal.reason);
      });
    });
  };
}

async function until(check: () => boolean) {
  for (let i = 0; i < 200 && !check(); i++)
    await new Promise((resolve) => {
      setTimeout(resolve, 1);
    });
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
  assert.notEqual(selection.file, file);
  assert.deepEqual(await bytes(selection.file), await bytes(file));
  store.dispose();
});

test("a failing library leaves the selection usable and says it was not kept", async () => {
  const store = new SkinSelectionStore({
    preview: autoPreview(),
    library: failing,
  });
  store.selectFiles([await skinFile(1)]);
  await until(() => store.getSnapshot().selection?.keep.kind === "off");
  const selection = required(store.getSnapshot().selection, "selection");
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
  assert.ok(old && next);
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

test("a newer file interrupts the older detection, so its failure is never reported", async () => {
  const failures: number[] = [];
  const preview = manualPreview();
  const store = new SkinSelectionStore({
    preview: preview.preview,
    events: {
      failed: (token) => {
        failures.push(token);
      },
    },
  });
  store.selectFiles([await skinFile(1, "old.png")]);
  await preview.next(1);
  store.selectFiles([await skinFile(2, "new.png")]);
  await preview.next(2);
  const [old] = preview.pending;
  assert.equal(old?.signal.aborted, true);
  // Let the aborted request reject.
  await new Promise((resolve) => {
    setTimeout(resolve, 5);
  });
  assert.deepEqual(failures, []);
  assert.equal(store.getSnapshot().selection?.status, "checking");
  store.dispose();
  assert.equal(preview.pending[1]?.signal.aborted, true);
});

test("detection does not overwrite a model the user already picked", async () => {
  const preview = manualPreview();
  const store = new SkinSelectionStore({ preview: preview.preview });
  store.selectFiles([await skinFile(1)]);
  await preview.next();
  store.setVariant("slim");
  preview.pending[0]?.events.detected("classic");
  assert.equal(store.getSnapshot().variant, "slim");
  store.dispose();
});

test("an editor model wins over detection", async () => {
  const store = new SkinSelectionStore({ preview: autoPreview("classic") });
  store.select(await skinFile(1), { origin: "editor", variant: "slim" });
  await until(() => store.getSnapshot().selection?.status === "ready");
  assert.equal(store.getSnapshot().variant, "slim");
  assert.equal(store.getSnapshot().selection?.origin, "editor");
  store.dispose();
});

test("gallery selection preserves its model and pixels without writing to the library", async () => {
  let writes = 0;
  const store = new SkinSelectionStore({
    preview: autoPreview("classic"),
    library: {
      ...failing,
      run: () => {
        writes++;
        return Promise.reject(new Error("Unexpected library write"));
      },
    },
  });
  const file = await skinFile(7);
  store.select(file, {
    origin: "gallery",
    galleryId: "forest-ranger",
    name: "Forest ranger",
    variant: "slim",
  });
  await until(() => store.getSnapshot().selection?.status === "ready");
  const state = store.getSnapshot();
  assert.equal(state.variant, "slim");
  assert.equal(state.selection?.galleryId, "forest-ranger");
  assert.equal(state.selection.skinId, undefined);
  assert.equal(state.selection.keep.kind, "catalog");
  assert.deepEqual(await bytes(state.selection.file), await bytes(file));
  store.setVariant("classic");
  store.refresh();
  assert.equal(writes, 0);
  store.dispose();
});

test("a late library write links only the selection that started it", async () => {
  const client = library();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
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
  // The first write can still be running once the second selection is kept.
  let listing = await client.run(withLibrary((l) => l.list));
  for (let i = 0; i < 200 && listing.skins.length < 2; i++) {
    await new Promise((resolve) => {
      setTimeout(resolve, 1);
    });
    listing = await client.run(withLibrary((l) => l.list));
  }
  const second = required(
    listing.skins.find((skin) => skin.name === "second"),
    "find result",
  );
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
    withLibrary((l) =>
      l.get(
        required(store.getSnapshot().selection?.skinId, "selected skin id"),
      ),
    ),
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
    events: {
      imported: (kept, failed) => {
        imported.push([kept, failed]);
      },
    },
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
  assert.deepEqual(listing.skins.map((skin) => skin.name).toSorted(), [
    "a",
    "b",
  ]);
  store.dispose();
});

test("a multi-file drop counts a first file that fails as not added", async () => {
  const client = library();
  const imported: [number, number][] = [];
  const store = new SkinSelectionStore({
    preview: autoPreview(),
    library: client,
    events: {
      imported: (kept, failed) => {
        imported.push([kept, failed]);
      },
    },
  });
  store.selectFiles([
    new File(["not a png"], "a.png", { type: "image/png" }),
    await skinFile(2, "b.png"),
    await skinFile(3, "c.png"),
  ]);
  await until(() => imported.length === 1);
  assert.deepEqual(imported, [[2, 1]]);
  assert.equal(store.getSnapshot().selection?.keep.kind, "off");
  store.dispose();
});

test("without a library, a multi-file drop selects the first file and reports no import", async () => {
  const imported: [number, number][] = [];
  const store = new SkinSelectionStore({
    preview: autoPreview(),
    events: {
      imported: (kept, failed) => {
        imported.push([kept, failed]);
      },
    },
  });
  store.selectFiles([await skinFile(1, "a.png"), await skinFile(2, "b.png")]);
  await until(() => store.getSnapshot().selection?.status === "ready");
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
  // The selection says the browser keeps nothing; the other files are not
  // counted as broken.
  assert.equal(store.getSnapshot().selection?.keep.kind, "off");
  assert.deepEqual(imported, []);
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
  const selected = required(
    store.getSnapshot().selection,
    "store.getSnapshot().selection",
  );
  await tabB.run(
    withLibrary((l) =>
      l.setVariant(required(selected.skinId, "selected.skinId"), "slim"),
    ),
  );
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
    withLibrary((l) =>
      l.remove(
        required(store.getSnapshot().selection?.skinId, "selected skin id"),
      ),
    ),
  );
  store.refresh();
  await until(() => store.getSnapshot().selection?.keep.kind === "removed");
  assert.equal(store.getSnapshot().selection?.status, "ready");
  store.dispose();
});

test("a populated library stays unselected on startup and library updates", async () => {
  const client = library();
  let imported = false;
  const seed = new SkinSelectionStore({
    preview: autoPreview(),
    library: client,
    events: {
      imported: () => {
        imported = true;
      },
    },
  });
  seed.selectFiles([await skinFile(1), await skinFile(2)]);
  await until(() => imported);
  seed.dispose();

  const preview = manualPreview();
  const store = new SkinSelectionStore({
    preview: preview.preview,
    library: client,
  });
  store.connect();
  try {
    const { skins } = await client.run(withLibrary((l) => l.list));
    assert.equal(skins.length, 2);
    assert.equal(store.getSnapshot().selection, null);

    await client.run(
      withLibrary((l) =>
        l.rename(required(skins[0], "stored skin").id, "Renamed skin"),
      ),
    );
    store.refresh();
    assert.equal(store.getSnapshot().selection, null);
    assert.equal(store.getSnapshot().previewUrl, null);
    assert.equal(preview.pending.length, 0);
  } finally {
    store.dispose();
  }
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
  assert.ok(skin);
  const store = new SkinSelectionStore({
    preview: autoPreview("classic"),
    library: client,
  });
  store.selectSkin({ ...skin, current: { ...skin.current, variant: "slim" } });
  await until(() => store.getSnapshot().selection?.status === "ready");
  const selection = required(store.getSnapshot().selection, "selection");
  assert.equal(selection.skinId, skin.id);
  assert.equal(selection.keep.kind, "kept");
  assert.equal(store.getSnapshot().variant, "slim");
  assert.deepEqual(await bytes(selection.file), await bytes(skin.current.png));
  store.dispose();
});

test("a generation result belongs to the exact snapshot and options", async () => {
  const file = await skinFile(1);
  const input = {
    purpose: "skin-url" as const,
    file,
    variant: "classic" as const,
    method: "axolotl",
    capeUuid: "none",
    name: "",
  };
  assert.equal(sameGenerationInput(input, { ...input }), true);
  for (const change of [
    { purpose: "createcustom" as const },
    { file: new File([file], file.name) },
    { variant: "slim" as const },
    { method: "mineskin" },
    { capeUuid: "cape" },
    { name: "lobby" },
  ])
    assert.equal(sameGenerationInput(input, { ...input, ...change }), false);
});
