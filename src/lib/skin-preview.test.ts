import assert from "node:assert/strict";
import { test } from "node:test";
import { startSkinPreview } from "./skin-preview";

test("WebGL initialization failure shows a fallback without escaping", () => {
  let failed = false;
  const stop = startSkinPreview(
    () => {
      throw new Error("Error creating WebGL context.");
    },
    { skin: "blob:skin" },
    () => assert.fail("Viewer started"),
    () => {
      failed = true;
    },
  );
  assert.equal(failed, true);
  assert.doesNotThrow(stop);
});

test("texture errors are handled and release the viewer once", async () => {
  let disposed = 0;
  let failed = 0;
  const stop = startSkinPreview(
    () => ({
      loadSkin: () => Promise.reject(new Error("Bad skin size: 1920x1080")),
      loadCape: () => Promise.reject(new Event("error")),
      dispose: () => {
        disposed++;
      },
    }),
    { skin: "blob:skin", cape: "https://example.com/cape" },
    () => undefined,
    () => {
      failed++;
    },
  );
  await Promise.resolve();
  stop();
  assert.equal(failed, 1);
  assert.equal(disposed, 1);
});

test("unmounted previews dispose the viewer and ignore late texture failures", async () => {
  let reject!: (cause: unknown) => void;
  let disposed = 0;
  const stop = startSkinPreview(
    () => ({
      loadSkin: () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail;
        }),
      loadCape: () => Promise.resolve(),
      dispose: () => {
        disposed++;
      },
    }),
    { skin: "blob:skin" },
    () => undefined,
    () => assert.fail("Unmounted preview published an error"),
  );
  stop();
  reject(new Event("error"));
  await Promise.resolve();
  assert.equal(disposed, 1);
});
