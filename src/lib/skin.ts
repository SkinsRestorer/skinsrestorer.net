"use client";

import { Context, Data, Effect } from "effect";

export type SkinVariant = "classic" | "slim";

export class SkinImageError extends Data.TaggedError("SkinImageError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class SkinImages extends Context.Service<
  SkinImages,
  {
    readonly create: () => HTMLImageElement;
    readonly variant: (image: HTMLImageElement) => SkinVariant;
  }
>()("skinsrestorer/SkinImages") {}

export const detectSkinVariantEffect = Effect.fn("Skin.detectVariant")(
  function* (imageUrl: string) {
    const images = yield* SkinImages;
    return yield* Effect.acquireUseRelease(
      Effect.try({
        try: images.create,
        catch: (cause) =>
          new SkinImageError({ message: "Failed to load image", cause }),
      }),
      (image) =>
        Effect.callback<SkinVariant, SkinImageError>((resume) => {
          image.crossOrigin = "Anonymous";
          image.onload = () =>
            resume(
              Effect.try({
                try: () => images.variant(image),
                catch: (cause) =>
                  new SkinImageError({
                    message:
                      cause instanceof Error
                        ? cause.message
                        : "Failed to detect skin type",
                    cause,
                  }),
              }),
            );
          image.onerror = () =>
            resume(
              Effect.fail(
                new SkinImageError({ message: "Failed to load image" }),
              ),
            );
          // Cached images can finish synchronously when src is assigned.
          try {
            image.src = imageUrl;
          } catch (cause) {
            resume(
              Effect.fail(
                new SkinImageError({ message: "Failed to load image", cause }),
              ),
            );
          }
        }),
      (image) =>
        Effect.sync(() => {
          image.onload = null;
          image.onerror = null;
          image.removeAttribute("src");
        }),
    );
  },
);

const browserImages: Context.Service.Shape<typeof SkinImages> = {
  create: () => new Image(),
  variant: (image) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);
    const px1 = ctx.getImageData(46, 52, 1, 12).data;
    const px2 = ctx.getImageData(54, 20, 1, 12).data;
    for (let i = 3; i < 12 * 4; i += 4)
      if (px1[i] === 255 || px2[i] === 255) return "classic";
    return "slim";
  },
};

/** Keep the preview URL alive until image callbacks finish or are cancelled. */
export function previewSkinFileEffect(
  file: File,
  events: {
    preview: (url: string) => void;
    detected: (variant: SkinVariant) => void;
    failed: (cause: SkinImageError) => void;
  },
  urls = {
    create: (file: File) => URL.createObjectURL(file),
    revoke: (url: string) => URL.revokeObjectURL(url),
  },
) {
  return Effect.acquireUseRelease(
    Effect.try({
      try: () => urls.create(file),
      catch: (cause) =>
        new SkinImageError({ message: "Failed to load image", cause }),
    }),
    (url) =>
      Effect.gen(function* () {
        yield* Effect.sync(() => events.preview(url));
        yield* detectSkinVariantEffect(url).pipe(
          Effect.tap((variant) => Effect.sync(() => events.detected(variant))),
          Effect.catch((cause) => Effect.sync(() => events.failed(cause))),
        );
        // The component still displays this URL after detection completes.
        yield* Effect.never;
      }),
    (url) => Effect.sync(() => urls.revoke(url)),
  );
}

export async function runSkinEffect<A, E>(
  program: Effect.Effect<A, E, SkinImages>,
  signal?: AbortSignal,
): Promise<A> {
  try {
    return await Effect.runPromise(
      program.pipe(Effect.provideService(SkinImages, browserImages)),
      { signal },
    );
  } catch (cause) {
    signal?.throwIfAborted();
    throw cause;
  }
}
export const detectSkinVariant = (imageUrl: string, signal?: AbortSignal) =>
  runSkinEffect(detectSkinVariantEffect(imageUrl), signal);

export function isValidSkinName(name: string): boolean {
  return /^[a-z0-9_]+$/.test(name);
}
