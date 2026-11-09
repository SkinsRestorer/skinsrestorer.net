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
    parseGalleryCatalog(catalog(entry(), entry("slim-ranger", "slim"))),
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

test("invalid catalogs and unsafe textures are rejected before images are requested", () => {
  for (const value of [
    { version: 2, skins: [] },
    catalog(entry(), entry()),
    catalog(entry("../other")),
    catalog({ ...entry(), value: "invalid" }),
    catalog({ ...entry(), signature: "" }),
    catalog(entry("other", "wide")),
    catalog(entry("other", undefined, "https://example.com/skin.png")),
    catalog(
      entry(
        "other",
        undefined,
        `https://user@textures.minecraft.net/texture/${hash}`,
      ),
    ),
    catalog({ ...entry(), skinName: " " }),
  ])
    assert.throws(() => parseGalleryCatalog(value));
});

test("name search matches every word without case or accent differences", () => {
  const skins = parseGalleryCatalog(catalog(entry()));
  assert.equal(searchGallery(skins, "RÁNGER forest").length, 1);
  assert.equal(searchGallery(skins, "ranger blue").length, 0);
  assert.equal(searchGallery(skins, " ").length, 1);
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
  const result = await run(async (url, init) => {
    requests++;
    assert.equal(String(url), GALLERY_URL);
    assert.equal(init?.credentials, "omit");
    assert.equal(init?.redirect, "error");
    assert.equal(init?.body, undefined);
    return Response.json(catalog(entry()));
  });
  assert.ok(Exit.isSuccess(result));
  assert.equal(result.value.length, 1);
  assert.equal(requests, 1);
  for (const response of [
    new Response("", { status: 503 }),
    new Response("invalid"),
    new Response("x".repeat(2 * 1024 * 1024 + 1)),
  ]) {
    const failed = await run(async () => response);
    assert.ok(Exit.isFailure(failed));
    assert.match(String(failed.cause), /The gallery could not be loaded/);
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
        init!.signal!.addEventListener("abort", () => {
          aborted = true;
          reject(init!.signal!.reason);
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
