import assert from "node:assert/strict";
import { test } from "node:test";
import { Effect, Exit } from "effect";
import { HttpClient, type HttpFetch } from "./effect-http";
import { createTemplate, exportSkinPng } from "./skin-document";
import { loadTextureEffect, parseTextureReference } from "./skin-texture";

const hash = "26c156a5a28ba3647b3de3b5bfec4d399670b1f063d6526ba201c2be01b60df5";

test("texture hashes and Mojang texture URLs are accepted and use HTTPS", () => {
  const expected = `https://textures.minecraft.net/texture/${hash}`;
  assert.equal(parseTextureReference(hash).url, expected);
  assert.equal(parseTextureReference(` ${hash.toUpperCase()} `).url, expected);
  assert.equal(
    parseTextureReference(`http://textures.minecraft.net/texture/${hash}`).url,
    expected,
  );
  assert.equal(parseTextureReference(expected).hash, hash);
});

test("other hosts, ports, credentials, and paths are rejected", () => {
  for (const input of [
    `https://s.namemc.com/i/${hash}.png`,
    `https://textures.minecraft.net.example.com/texture/${hash}`,
    `https://textures.minecraft.net:8443/texture/${hash}`,
    `https://user@textures.minecraft.net/texture/${hash}`,
    `https://textures.minecraft.net/other/${hash}`,
    `https://textures.minecraft.net/texture/${hash}?redirect=1`,
    `javascript:alert(1)`,
    "steve",
  ])
    assert.throws(
      () => parseTextureReference(input),
      { _tag: "TextureImportError" },
      input,
    );
});

const run = <A, E>(
  program: Effect.Effect<A, E, HttpClient>,
  fetch: HttpFetch,
  signal?: AbortSignal,
) =>
  Effect.runPromiseExit(
    program.pipe(Effect.provideService(HttpClient, { fetch })),
    { signal },
  );

test("a texture downloads without credentials or redirects and opens locally", async () => {
  const png = await exportSkinPng(createTemplate("slim").pixels);
  let request: { url: string; init?: RequestInit } | undefined;
  const exit = await run(loadTextureEffect(hash), async (url, init) => {
    request = { url: String(url), init };
    return new Response(png as Uint8Array<ArrayBuffer>, {
      headers: { "content-type": "image/png" },
    });
  });
  assert.ok(Exit.isSuccess(exit));
  assert.equal(exit.value.hash, hash);
  assert.equal(exit.value.document.variant, "slim");
  assert.equal(request?.url, `https://textures.minecraft.net/texture/${hash}`);
  assert.equal(request?.init?.redirect, "error");
  assert.equal(request?.init?.credentials, "omit");
});

test("rejected hosts never reach the network and missing textures explain why", async () => {
  let calls = 0;
  const other = await run(
    loadTextureEffect("https://example.com/skin.png"),
    async () => {
      calls++;
      return new Response();
    },
  );
  assert.ok(Exit.isFailure(other));
  assert.equal(calls, 0);
  const missing = await run(
    loadTextureEffect(hash),
    async () => new Response("", { status: 404 }),
  );
  assert.ok(Exit.isFailure(missing));
  assert.match(String(missing.cause), /No texture exists/);
});

test("cancelling a texture read aborts the request", async () => {
  let signal: AbortSignal | null | undefined;
  let started!: () => void;
  const ready = new Promise<void>((resolve) => (started = resolve));
  const controller = new AbortController();
  const pending = run(
    loadTextureEffect(hash),
    (_url, init) => {
      signal = init?.signal;
      started();
      return new Promise(() => undefined);
    },
    controller.signal,
  );
  await ready;
  controller.abort();
  const exit = await pending;
  assert.ok(Exit.isFailure(exit));
  assert.equal(signal?.aborted, true);
});
