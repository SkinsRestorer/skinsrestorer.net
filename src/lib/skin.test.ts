import assert from "node:assert/strict";
import { test } from "node:test";
import { Effect, Fiber } from "effect";
import {
  detectSkinVariantEffect,
  previewSkinFileEffect,
  SkinImages,
} from "./skin";

function imageFixture(cached = false) {
  const image = {
    onload: null as (() => void) | null,
    onerror: null as (() => void) | null,
    crossOrigin: "",
    value: "",
    set src(value: string) {
      this.value = value;
      if (cached && value) this.onload?.();
    },
    removeAttribute() {
      this.value = "";
    },
    get src() {
      return this.value;
    },
  };
  const service = {
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
  assert.equal(image.onload, null);
  assert.equal(image.onerror, null);
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
  assert.equal(image.onload, null);
  assert.equal(image.onerror, null);
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
  assert.equal(image.onload, null);
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
              assert.equal(image.onload, null);
              assert.equal(image.src, "");
              observed.push(`revoke:${url}`);
            },
          },
        ),
      );
      yield* Effect.yieldNow;
      assert.deepEqual(observed, ["blob:owned"]);
      yield* Fiber.interrupt(preview);
    }).pipe(Effect.provideService(SkinImages, service)),
  );
  assert.deepEqual(observed, ["blob:owned", "revoke:blob:owned"]);
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
              assert.equal(image.onload, null);
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
