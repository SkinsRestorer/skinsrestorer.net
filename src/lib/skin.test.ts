import assert from "node:assert/strict";
import { test } from "node:test";
import { Effect, Fiber } from "effect";
import {
  detectSkinVariantEffect,
  previewSkinFileEffect,
  SkinImages,
  validateSkinDimensions,
  withSkinImageEffect,
} from "./skin";

function imageFixture(cached = false) {
  const listeners = new Set<{ type: string; listener: () => void }>();
  const image = {
    naturalWidth: 64,
    naturalHeight: 64,
    listeners,
    crossOrigin: "",
    value: "",
    addEventListener(
      type: string,
      listener: () => void,
      options?: { signal?: AbortSignal },
    ) {
      const entry = { type, listener };
      listeners.add(entry);
      options?.signal?.addEventListener("abort", () => listeners.delete(entry));
    },
    set src(value: string) {
      this.value = value;
      if (!cached || !value) return;
      for (const entry of listeners)
        if (entry.type === "load") entry.listener();
    },
    removeAttribute() {
      this.value = "";
    },
    get src() {
      return this.value;
    },
  };
  const service = {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The fake implements only the image members the loader uses.
    create: () => image as unknown as HTMLImageElement,
    variant: () => "slim" as const,
  };
  return { image, service };
}

test("cached images have handlers before loading and release them after detection", async () => {
  const { image, service } = imageFixture(true);
  assert.equal(
    await Effect.runPromise(
      detectSkinVariantEffect("blob:skin").pipe(
        Effect.provideService(SkinImages, service),
      ),
    ),
    "slim",
  );
  assert.equal(image.listeners.size, 0);
  assert.equal(image.src, "");
});

test("cancelling image detection removes handlers before releasing the source", async () => {
  const { image, service } = imageFixture();
  const controller = new AbortController();
  const pending = Effect.runPromiseExit(
    detectSkinVariantEffect("blob:skin").pipe(
      Effect.provideService(SkinImages, service),
    ),
    { signal: controller.signal },
  );
  await Promise.resolve();
  controller.abort();
  await pending;
  assert.equal(image.listeners.size, 0);
  assert.equal(image.src, "");
});

test("canvas failures remain typed and release the loaded image", async () => {
  const { image, service } = imageFixture(true);
  await assert.rejects(
    Effect.runPromise(
      detectSkinVariantEffect("blob:skin").pipe(
        Effect.provideService(SkinImages, {
          ...service,
          variant() {
            throw new Error("Failed to get canvas context");
          },
        }),
      ),
    ),
    { _tag: "SkinImageError", message: "Failed to get canvas context" },
  );
  assert.equal(image.listeners.size, 0);
});

test("preview URLs outlive image callbacks and are released after cancellation", async () => {
  const { image, service } = imageFixture();
  const observed: string[] = [];
  await Effect.runPromise(
    Effect.gen(function* () {
      const preview = yield* Effect.forkChild(
        previewSkinFileEffect(
          new File([], "skin.png"),
          {
            preview: (url) => observed.push(url),
            detected: () => observed.push("detected"),
            failed: () => observed.push("failed"),
          },
          {
            create: () => "blob:owned",
            revoke: (url) => {
              assert.equal(image.listeners.size, 0);
              assert.equal(image.src, "");
              observed.push(`revoke:${url}`);
            },
          },
        ),
      );
      yield* Effect.yieldNow;
      assert.deepEqual(observed, []);
      yield* Fiber.interrupt(preview);
    }).pipe(Effect.provideService(SkinImages, service)),
  );
  assert.deepEqual(observed, ["revoke:blob:owned"]);
});

test("skin dimensions preserve square, legacy, and scaled textures", () => {
  for (const [width, height] of [
    [64, 64],
    [64, 32],
    [128, 128],
    [128, 64],
  ]) {
    assert.doesNotThrow(() => validateSkinDimensions(width, height));
  }
  for (const [width, height] of [
    [0, 0],
    [64, 0],
    [1920, 1080],
    [1402, 1122],
  ]) {
    assert.throws(() => validateSkinDimensions(width, height), {
      _tag: "SkinImageError",
    });
  }
});

test("invalid images never reach the preview or variant detector and release their URLs", async () => {
  const { image, service } = imageFixture(true);
  image.naturalWidth = 1920;
  image.naturalHeight = 1080;
  let message = "";
  let revoked = false;
  await Effect.runPromise(
    previewSkinFileEffect(
      new File([], "screenshot.png"),
      {
        preview: () => assert.fail("Invalid image reached the viewer"),
        detected: () => assert.fail("Invalid image was accepted"),
        failed: (cause) => {
          message = cause.message;
        },
      },
      {
        create: () => "blob:invalid",
        revoke: () => {
          revoked = true;
        },
      },
    ).pipe(
      Effect.provideService(SkinImages, {
        ...service,
        variant: () => assert.fail("Invalid image reached canvas detection"),
      }),
    ),
  );
  assert.match(message, /1920×1080/);
  assert.match(message, /64×64/);
  assert.equal(revoked, true);
});

test("successful detection keeps the preview URL until its owner is cancelled", async () => {
  const { image, service } = imageFixture(true);
  let revoked = false;
  let detected = false;
  await Effect.runPromise(
    Effect.gen(function* () {
      const preview = yield* Effect.forkChild(
        previewSkinFileEffect(
          new File([], "skin.png"),
          {
            preview: () => undefined,
            detected: () => {
              detected = true;
            },
            failed: () => assert.fail("Unexpected image failure"),
          },
          {
            create: () => "blob:preview",
            revoke: () => {
              revoked = true;
              assert.equal(image.listeners.size, 0);
            },
          },
        ),
      );
      yield* Effect.yieldNow;
      assert.equal(detected, true);
      assert.equal(revoked, false);
      yield* Fiber.interrupt(preview);
    }).pipe(Effect.provideService(SkinImages, service)),
  );
  assert.equal(revoked, true);
});

test("a superseded image load never reaches its user", async () => {
  const { image, service } = imageFixture();
  const used: unknown[] = [];
  const controller = new AbortController();
  const pending = Effect.runPromiseExit(
    withSkinImageEffect("blob:old", (loaded) => used.push(loaded)).pipe(
      Effect.provideService(SkinImages, service),
    ),
    { signal: controller.signal },
  );
  await Promise.resolve();
  const loads = [...image.listeners].filter((entry) => entry.type === "load");
  assert.equal(loads.length, 1);
  controller.abort();
  await pending;
  // A late load event from the browser finds no owner.
  for (const entry of loads) entry.listener();
  assert.deepEqual(used, []);
  assert.equal(image.listeners.size, 0);
  assert.equal(image.src, "");
});

test("a loaded image is used while it is still attached", async () => {
  const { image, service } = imageFixture(true);
  const seen = await Effect.runPromise(
    withSkinImageEffect(
      "https://textures.minecraft.net/texture/a",
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The loader hands back the fake from `create`.
      (loaded) => (loaded as unknown as typeof image).src,
    ).pipe(Effect.provideService(SkinImages, service)),
  );
  assert.equal(seen, "https://textures.minecraft.net/texture/a");
  assert.equal(image.crossOrigin, "Anonymous");
  assert.equal(image.src, "");
});
