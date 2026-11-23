import assert from "node:assert/strict";
import { test } from "node:test";
import { Effect, Exit } from "effect";
import { HttpClient, type HttpFetch } from "./effect-http";
import {
  GALLERY_URL,
  galleryPermalink,
  loadGalleryEffect,
  parseGalleryCatalog,
  searchGallery,
} from "./skin-gallery";
import { required } from "./utils";

const hash = "a".repeat(64);
const texture = `http://textures.minecraft.net/texture/${hash}`;
const entry = (id = "forest-ranger", model?: string, url = texture) => ({
  skinId: id,
  skinName: "Forest ranger",
  signature: "signed",
  value: btoa(
    JSON.stringify({
      textures: { SKIN: { url, ...(model ? { metadata: { model } } : {}) } },
    }),
  ),
});
const catalog = (...skins: ReturnType<typeof entry>[]) => ({
  version: 1,
  skins,
});

test("catalog metadata supplies public IDs, HTTPS textures, names and explicit models", () => {
  assert.deepEqual(
    parseGalleryCatalog(catalog(entry(), entry("slim-ranger", "slim"))).skins,
    [
      {
        id: "forest-ranger",
        name: "Forest ranger",
        textureUrl: texture.replace("http:", "https:"),
        variant: "classic",
      },
      {
        id: "slim-ranger",
        name: "Forest ranger",
        textureUrl: texture.replace("http:", "https:"),
        variant: "slim",
      },
    ],
  );
});

const invalidEntries = [
  entry("../other"),
  { ...entry("bad-value"), value: "invalid" },
  { ...entry("unsigned"), signature: "" },
  entry("wide-model", "wide"),
  entry("other-host", undefined, "https://example.com/skin.png"),
  entry(
    "with-user",
    undefined,
    `https://user@textures.minecraft.net/texture/${hash}`,
  ),
  { ...entry("blank-name"), skinName: " " },
  { ...entry("long-name"), skinName: "x".repeat(121) },
];

test("invalid and unsafe entries are skipped and counted, and the rest stay", () => {
  const parsed = parseGalleryCatalog(
    catalog(entry(), ...invalidEntries, entry(), entry("slim-ranger", "slim")),
  );
  assert.deepEqual(
    parsed.skins.map((skin) => skin.id),
    ["forest-ranger", "slim-ranger"],
  );
  // Each invalid entry and the repeated id.
  assert.equal(parsed.skipped, invalidEntries.length + 1);
  assert.deepEqual(parseGalleryCatalog(catalog()), { skins: [], skipped: 0 });
});

test("a catalog without one valid entry is rejected before images are requested", () => {
  assert.throws(() => parseGalleryCatalog({ version: 2, skins: [] }));
  assert.throws(() => parseGalleryCatalog(catalog(...invalidEntries)));
  for (const invalid of invalidEntries)
    assert.throws(() => parseGalleryCatalog(catalog(invalid)));
});

test("name search matches every word without case or accent differences", () => {
  const { skins } = parseGalleryCatalog(catalog(entry()));
  assert.equal(searchGallery(skins, "RÁNGER forest").length, 1);
  assert.equal(searchGallery(skins, "ranger blue").length, 0);
  assert.equal(searchGallery(skins, " ").length, 1);
  assert.equal(searchGallery(skins, "rang FOR").length, 1);
  const accented = [
    { ...required(skins[0], "gallery skin"), name: "Café Señor" },
  ];
  assert.equal(searchGallery(accented, "cafe senor").length, 1);
  assert.equal(searchGallery(accented, "CAFÉ").length, 1);
});

test("gallery search ignores spaces and punctuation inside names", () => {
  const skin = required(
    parseGalleryCatalog(catalog(entry())).skins[0],
    "gallery skin",
  );
  const named = (name: string) => [{ ...skin, name }];
  assert.equal(searchGallery(named("Dark Knight"), "darkknight").length, 1);
  assert.equal(searchGallery(named("Dark Knight"), "dark-knight").length, 1);
  assert.equal(searchGallery(named("Dark_Knight"), "dark knight").length, 1);
  assert.equal(searchGallery(named("Spider-Man 2"), "spiderman2").length, 1);
  assert.equal(searchGallery(named("Dark Knight"), "darkness").length, 0);
  assert.equal(searchGallery(named("Dark Knight"), "-").length, 0);
});

test("gallery links preserve locale and fixed purpose without private library IDs", () => {
  assert.equal(
    galleryPermalink("forest-ranger", "en"),
    "/studio?skin=forest-ranger",
  );
  assert.equal(
    galleryPermalink("forest-ranger", "ru", "createcustom"),
    "/ru/studio?skin=forest-ranger&intent=createcustom",
  );
});

const run = (fetch: HttpFetch, signal?: AbortSignal) =>
  Effect.runPromiseExit(
    loadGalleryEffect().pipe(Effect.provideService(HttpClient, { fetch })),
    { signal },
  );

test("catalog requests are bounded credential-free GETs with no redirects", async () => {
  let requests = 0;
  const result = await run((url, init) => {
    requests++;
    assert.equal(
      url instanceof Request ? url.url : url.toString(),
      GALLERY_URL,
    );
    assert.equal(init?.credentials, "omit");
    assert.equal(init.redirect, "error");
    assert.equal(init.body, undefined);
    return Promise.resolve(Response.json(catalog(entry())));
  });
  assert.ok(Exit.isSuccess(result));
  assert.equal(result.value.length, 1);
  assert.equal(requests, 1);
  const partial = await run(() =>
    Promise.resolve(Response.json(catalog(entry(), entry("../other")))),
  );
  assert.ok(Exit.isSuccess(partial));
  assert.equal(partial.value.length, 1);
  for (const response of [
    new Response("", { status: 503 }),
    Response.json(catalog(entry("../other"))),
    new Response("invalid"),
    new Response("x".repeat(2 * 1024 * 1024 + 1)),
  ]) {
    const failed = await run(() => Promise.resolve(response));
    assert.ok(Exit.isFailure(failed));
    assert.match(String(failed.cause), /The gallery could not be loaded/u);
  }
});

test("cancelling catalog loading aborts the request", async () => {
  let ready!: () => void;
  const started = new Promise<void>((resolve) => {
    ready = resolve;
  });
  let aborted = false;
  const controller = new AbortController();
  const pending = run(
    async (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = required(init?.signal, "request signal");
        signal.addEventListener("abort", () => {
          aborted = true;
          // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- an abort reason is typed any; the signal rejects with its DOMException
          reject(signal.reason);
        });
        ready();
      }),
    controller.signal,
  );
  await started;
  controller.abort();
  assert.ok(Exit.isFailure(await pending));
  assert.equal(aborted, true);
});
