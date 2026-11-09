import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { HttpFetch } from "./effect-http";
import { uploadMineSkinFile, type MineSkinCompletedResponse } from "./mineskin";
import type { GenerationInput } from "./skin-selection";
import {
  fixedPurpose,
  generatedCommand,
  MAX_GALLERY_QUERY,
  readSkinFileTexture,
  skinSource,
  studioSearch,
  withGallerySkin,
  withoutSkinReference,
  suggestSkinName,
  textureUrlFromValue,
} from "./studio";
import {
  generationResult,
  StudioGeneration,
  type Upload,
} from "./studio-generation";

const texture =
  "https://textures.minecraft.net/texture/26c156a5a28ba3647b3de3b5bfec4d399670b1f063d6526ba201c2be01b60df5";
const value = btoa(
  JSON.stringify({
    textures: { SKIN: { url: texture.replace("https", "http") } },
  }),
);

function response(uuid: string, url?: string): MineSkinCompletedResponse {
  return {
    success: true,
    skin: {
      uuid,
      url,
      name: null,
      texture: { data: { value, signature: "s" } },
    },
  };
}

function input(change: Partial<GenerationInput> = {}): GenerationInput {
  return {
    purpose: "skin-url",
    file: new File([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], "a.png", {
      type: "image/png",
    }),
    variant: "classic",
    method: "axolotl",
    capeUuid: "__no_cape__",
    name: "",
    ...change,
  };
}

/** An upload the test finishes by hand. */
function manualUpload() {
  const calls: {
    file: File;
    signal: AbortSignal;
    resolve: (value: MineSkinCompletedResponse) => void;
    reject: (cause: unknown) => void;
  }[] = [];
  const upload: Upload = (options, signal) =>
    new Promise((resolve, reject) =>
      calls.push({ file: options.file, signal, resolve, reject }),
    );
  return { calls, upload };
}

test("Studio search keeps only known intents and one public reference", () => {
  // A handoff wins over a texture, and a texture over a gallery skin.
  assert.deepEqual(
    studioSearch({
      intent: "createcustom",
      texture: "abc",
      handoff: "id",
      skin: "boy",
    }),
    { intent: "createcustom", handoff: "id" },
  );
  assert.deepEqual(studioSearch({ texture: " abc ", skin: "boy" }), {
    texture: "abc",
  });
  assert.deepEqual(studioSearch({ intent: "hack", texture: "", other: 1 }), {});
  assert.deepEqual(
    studioSearch({ skin: "boy-white-shirt", intent: "skin-url" }),
    { skin: "boy-white-shirt", intent: "skin-url" },
  );
  for (const skin of ["../private", "", "a".repeat(101), null, ["a"], {}])
    assert.deepEqual(studioSearch({ skin }), {});
  // The router decodes numeric values; gallery IDs can be digits.
  assert.deepEqual(studioSearch({ skin: 2024 }), { skin: "2024" });
  assert.deepEqual(studioSearch({ handoff: "x".repeat(129) }), {});
});

test("Studio search omits defaults and keeps search text only with the gallery", () => {
  // A gallery link opens the gallery, so its source is implied.
  assert.equal(skinSource(studioSearch({ skin: "boy" })), "gallery");
  assert.deepEqual(studioSearch({ skin: "boy", source: "gallery" }), {
    skin: "boy",
  });
  assert.deepEqual(studioSearch({ skin: "boy", source: "library" }), {
    skin: "boy",
    source: "library",
  });
  assert.deepEqual(studioSearch({ source: "library" }), {});
  assert.deepEqual(studioSearch({ source: "shelf" }), {});
  assert.deepEqual(studioSearch({ source: "gallery", q: "  red hat " }), {
    source: "gallery",
    q: "red hat",
  });
  assert.deepEqual(studioSearch({ q: "red" }), {});
  assert.deepEqual(studioSearch({ source: "gallery", q: "   " }), {
    source: "gallery",
  });
  assert.deepEqual(studioSearch({ source: "gallery", q: 42 }), {
    source: "gallery",
    q: "42",
  });
  assert.equal(
    studioSearch({ source: "gallery", q: "x".repeat(300) }).q?.length,
    MAX_GALLERY_QUERY,
  );
});

test("selecting and clearing a skin keep the list and other URL state", () => {
  const gallery = studioSearch({
    source: "gallery",
    q: "hat",
    intent: "createcustom",
  });
  const chosen = withGallerySkin(gallery, "red-hat");
  assert.deepEqual(chosen, {
    intent: "createcustom",
    skin: "red-hat",
    q: "hat",
  });
  assert.equal(skinSource(chosen), "gallery");
  // A library skin replaces the public reference but keeps the gallery open.
  assert.deepEqual(withoutSkinReference(chosen), {
    intent: "createcustom",
    source: "gallery",
    q: "hat",
  });
  // A gallery skin chosen while the library shows keeps the library.
  const fromLibrary = withGallerySkin(
    studioSearch({ texture: "abc" }),
    "red-hat",
  );
  assert.deepEqual(fromLibrary, { skin: "red-hat", source: "library" });
  assert.deepEqual(withoutSkinReference(fromLibrary), {});
  assert.deepEqual(
    withoutSkinReference(studioSearch({ handoff: "id", intent: "skin-url" })),
    { intent: "skin-url" },
  );
});

test("Upload and Generator URLs fix their purpose over a contradictory intent", () => {
  assert.equal(fixedPurpose("upload", "createcustom"), "skin-url");
  assert.equal(fixedPurpose("generator", "skin-url"), "createcustom");
  assert.equal(fixedPurpose("studio", "createcustom"), "createcustom");
  assert.equal(fixedPurpose("studio"), undefined);
});

test("custom skin name suggestions are valid command names", () => {
  assert.equal(suggestSkinName("Forest ranger"), "forest_ranger");
  assert.equal(
    suggestSkinName("Café Night-Smith (2).png"),
    "cafe_night_smith_2",
  );
  assert.equal(suggestSkinName("Скин"), "");
});

test("commands keep the URL quoted and the model last", () => {
  assert.equal(
    generatedCommand("skin-url", { url: texture, name: "" }, "slim"),
    `/skin url "${texture}" slim`,
  );
  assert.equal(
    generatedCommand(
      "createcustom",
      { url: texture, name: "lobby" },
      "classic",
    ),
    `/sr createcustom lobby "${texture}" classic`,
  );
});

test("skin files reveal their HTTPS texture, in current and legacy formats", () => {
  assert.equal(textureUrlFromValue(value), texture);
  assert.equal(textureUrlFromValue("not base64!"), null);
  assert.deepEqual(readSkinFileTexture(JSON.stringify({ value })), {
    url: texture,
    legacy: false,
  });
  assert.deepEqual(readSkinFileTexture(`${value}\nsignature\n0`), {
    url: texture,
    legacy: true,
  });
  assert.throws(() => readSkinFileTexture("{}"), /No skin URL/);
});

test("generation sends the exact selected file once and builds the command", async () => {
  const { calls, upload } = manualUpload();
  const generation = new StudioGeneration(upload);
  const chosen = input({
    purpose: "createcustom",
    name: "lobby",
    variant: "slim",
  });
  const done = generation.generate(chosen, {
    file: chosen.file,
    variant: "slim",
    name: "lobby",
  });
  assert.equal(generation.for(chosen).status, "pending");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].file, chosen.file);
  calls[0].resolve(response("uuid", "https://minesk.in/abc"));
  await done;
  const state = generation.for(chosen);
  assert.equal(state.status, "done");
  assert.deepEqual(state.status === "done" && state.result, {
    url: "https://minesk.in/abc",
    command: '/sr createcustom lobby "https://minesk.in/abc" slim',
    textureUrl: texture,
  });
});

test("a result is hidden for other choices and a superseded upload never publishes", async () => {
  const { calls, upload } = manualUpload();
  const generation = new StudioGeneration(upload);
  const first = input();
  const firstRun = generation.generate(first, {
    file: first.file,
    variant: "classic",
  });
  for (const change of [
    { variant: "slim" as const },
    { method: "mineskin" },
    { capeUuid: "cape" },
    { purpose: "createcustom" },
    { name: "x" },
    { file: new File([first.file], "a.png") },
  ])
    assert.equal(generation.for({ ...first, ...change }).status, "idle");

  generation.cancel();
  assert.equal(calls[0].signal.aborted, true);
  calls[0].resolve(response("late"));
  await firstRun;
  assert.equal(generation.for(first).status, "idle");

  const second = input({ variant: "slim" });
  const secondRun = generation.generate(second, {
    file: second.file,
    variant: "slim",
  });
  calls[1].reject(new Error("Queue is full"));
  await secondRun;
  const failed = generation.for(second);
  assert.equal(failed.status, "failed");
  assert.equal(failed.status === "failed" && failed.message, "Queue is full");
  // A failure is not retried on its own.
  assert.equal(calls.length, 2);
});

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("the Axolotl cape route posts the selected bytes without the user key", async () => {
  const requests: Parameters<HttpFetch>[] = [];
  globalThis.fetch = Object.assign(async (...args: Parameters<HttpFetch>) => {
    requests.push(args);
    return Response.json({
      success: true,
      skin: { url: "skinsrestorer-axolotl://uuid" },
      warnings: [],
      messages: [],
    });
  }, originalFetch);
  const chosen = input({ capeUuid: "cape-id" });
  const generation = new StudioGeneration(uploadMineSkinFile);
  await generation.generate(chosen, {
    file: chosen.file,
    variant: "classic",
    capeUuid: "cape-id",
    apiKey: "secret",
    useCapeProxy: true,
  });
  assert.equal(requests.length, 1);
  const [url, init] = requests[0];
  assert.equal(String(url), "https://axolotl.skinsrestorer.net/mineskin/skins");
  assert.equal(new Headers(init?.headers).get("Authorization"), null);
  const form = init?.body as FormData;
  assert.equal(form.get("capeUuid"), "cape-id");
  assert.deepEqual(
    new Uint8Array(await (form.get("file") as File).arrayBuffer()),
    new Uint8Array(await chosen.file.arrayBuffer()),
  );
  const state = generation.for(chosen);
  assert.equal(
    state.status === "done" && state.result.command,
    '/skin url "skinsrestorer-axolotl://uuid" classic',
  );
  assert.equal(state.status === "done" && state.result.textureUrl, null);
});

test("URL-only proxy results support explicit and default custom skin names", () => {
  const url = "skinsrestorer-axolotl://v2.test-payload";
  for (const [name, filename, expected] of [
    ["lobby", "Forest ranger.png", "lobby"],
    ["", "Forest ranger.png", "forest_ranger"],
    ["", "Скин.png", "custom_skin"],
  ]) {
    const chosen = input({
      purpose: "createcustom",
      name,
      file: new File([], filename),
      variant: "slim",
    });
    assert.deepEqual(
      generationResult(chosen, { success: true, skin: { url } }),
      {
        command: `/sr createcustom ${expected} "${url}" slim`,
        url,
        textureUrl: null,
      },
    );
  }
});
