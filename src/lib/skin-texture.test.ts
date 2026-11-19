import assert from "node:assert/strict";
import { test } from "node:test";
import { Effect, Exit } from "effect";
import { HttpClient, type HttpFetch } from "./effect-http";
import { createTemplate, exportSkinPng } from "./skin-document";
import { encodePng } from "./png";
import {
  loadTextureEffect,
  loadTexturePreviewEffect,
  parseTextureReference,
} from "./skin-texture";

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
    // oxlint-disable-next-line eslint/no-script-url -- Verify that texture imports reject script URLs.
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
  const exit = await run(loadTextureEffect(hash), (url, init) => {
    request = { url: url instanceof Request ? url.url : url.toString(), init };
    return Promise.resolve(
      new Response(png, {
        headers: { "content-type": "image/png" },
      }),
    );
  });
  assert.ok(Exit.isSuccess(exit));
  assert.equal(exit.value.hash, hash);
  assert.equal(exit.value.document.variant, "slim");
  assert.equal(request?.url, `https://textures.minecraft.net/texture/${hash}`);
  assert.equal(request.init?.redirect, "error");
  assert.equal(request.init.credentials, "omit");
});

test("rejected hosts never reach the network and missing textures explain why", async () => {
  let calls = 0;
  const other = await run(
    loadTextureEffect("https://example.com/skin.png"),
    () => {
      calls++;
      return Promise.resolve(new Response());
    },
  );
  assert.ok(Exit.isFailure(other));
  assert.equal(calls, 0);
  const missing = await run(loadTextureEffect(hash), () =>
    Promise.resolve(new Response("", { status: 404 })),
  );
  assert.ok(Exit.isFailure(missing));
  assert.match(String(missing.cause), /No texture exists/u);
});

test("cancelling a texture read aborts the request", async () => {
  let signal: AbortSignal | null | undefined;
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const controller = new AbortController();
  const pending = run(
    loadTextureEffect(hash),
    (_url, init) => {
      signal = init?.signal;
      started();
      return new Promise(() => {});
    },
    controller.signal,
  );
  await ready;
  controller.abort();
  const exit = await pending;
  assert.ok(Exit.isFailure(exit));
  assert.equal(signal?.aborted, true);
});

test("previews return the downloaded PNG after a header check", async () => {
  const png = await exportSkinPng(createTemplate("classic").pixels);
  const exit = await run(loadTexturePreviewEffect(hash), () =>
    Promise.resolve(new Response(png)),
  );
  assert.ok(Exit.isSuccess(exit));
  assert.equal(exit.value.type, "image/png");
  assert.deepEqual(new Uint8Array(await exit.value.arrayBuffer()), png);
  for (const body of [
    new TextEncoder().encode("<html>not a png</html>"),
    await encodePng(new Uint8ClampedArray(16 * 16 * 4), 16, 16),
  ]) {
    const rejected = await run(loadTexturePreviewEffect(hash), () =>
      Promise.resolve(new Response(body)),
    );
    assert.ok(Exit.isFailure(rejected));
  }
});

test("preview downloads run at most six at a time", async () => {
  const png = await exportSkinPng(createTemplate("classic").pixels);
  let active = 0;
  let peak = 0;
  const release: (() => void)[] = [];
  const fetch: HttpFetch = async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise<void>((resolve) => {
      release.push(resolve);
    });
    active--;
    return new Response(png);
  };
  const pending = Promise.all(
    Array.from({ length: 10 }, () =>
      run(loadTexturePreviewEffect(hash), fetch),
    ),
  );
  while (release.length < 6)
    await new Promise((resolve) => {
      setTimeout(resolve);
    });
  await new Promise((resolve) => {
    setTimeout(resolve, 10);
  });
  assert.equal(peak, 6);
  // oxlint-disable-next-line eslint/no-unmodified-loop-condition -- the released loads decrement `active` between iterations.
  while (release.length > 0 || active > 0) {
    release.splice(0).forEach((resolve) => {
      resolve();
    });
    await new Promise((resolve) => {
      setTimeout(resolve);
    });
  }
  const exits = await pending;
  assert.ok(exits.every((exit) => Exit.isSuccess(exit)));
  assert.equal(peak, 6);
});
