"use client";

import {
  MessageError,
  errorFields,
  messageFields,
  type MessageKey,
} from "./messages";
import { messageKeySchema, messageValuesSchema } from "./messages/schema";

import { Context, Effect, Schema } from "effect";
import { detectVariantFromPixels } from "./skin-document";

export type SkinVariant = "classic" | "slim";

// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is a class factory.
export class SkinImageError extends Schema.TaggedError<
  SkinImageError,
  { readonly brand: unique symbol }
>()("SkinImageError", {
  message: Schema.String,
  messageKey: Schema.optional(messageKeySchema),
  messageValues: Schema.optional(messageValuesSchema),
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SkinImages extends Context.Service<
  SkinImages,
  {
    readonly create: () => HTMLImageElement;
    readonly variant: (image: HTMLImageElement) => SkinVariant;
  }
>()("skinsrestorer.net/lib/skin/SkinImages") {}

export function validateSkinDimensions(width: number, height: number): void {
  if (width <= 0 || height <= 0 || (width !== height && width !== height * 2)) {
    throw SkinImageError.make({
      ...messageFields("errors.imageDimensions", { width, height }),
    });
  }
}

/**
 * Load an image and pass it to `read` while it is still owned here. `read` runs
 * synchronously after the load and never after interruption. Handlers are
 * removed before the source is released, so a caller can revoke its URL.
 */
export function withSkinImageEffect<A>(
  imageUrl: string,
  read: (image: HTMLImageElement) => A,
  failure: MessageKey = "common.failedLoadImage",
) {
  return Effect.gen(function* () {
    const images = yield* SkinImages;
    return yield* Effect.acquireUseRelease(
      Effect.try({
        try: () => ({
          image: images.create(),
          listeners: new AbortController(),
        }),
        catch: (cause) =>
          SkinImageError.make({
            ...messageFields("common.failedLoadImage"),
            cause,
          }),
      }),
      ({ image, listeners }) =>
        Effect.callback<A, SkinImageError>((resume) => {
          const { signal } = listeners;
          image.crossOrigin = "Anonymous";
          image.addEventListener(
            "load",
            () => {
              resume(
                Effect.try({
                  try: () => read(image),
                  catch: (cause) =>
                    SkinImageError.make({
                      ...errorFields(cause, failure),
                      cause,
                    }),
                }),
              );
            },
            { signal },
          );
          image.addEventListener(
            "error",
            () => {
              resume(
                Effect.fail(
                  SkinImageError.make({
                    ...messageFields("common.failedLoadImage"),
                  }),
                ),
              );
            },
            { signal },
          );
          // Cached images can finish synchronously when src is assigned.
          try {
            image.src = imageUrl;
          } catch (cause) {
            resume(
              Effect.fail(
                SkinImageError.make({
                  ...messageFields("common.failedLoadImage"),
                  cause,
                }),
              ),
            );
          }
        }),
      ({ image, listeners }) =>
        Effect.sync(() => {
          listeners.abort();
          image.removeAttribute("src");
        }),
    );
  });
}

export const detectSkinVariantEffect = Effect.fn("Skin.detectVariant")(
  function* (imageUrl: string) {
    const images = yield* SkinImages;
    return yield* withSkinImageEffect(
      imageUrl,
      (image) => {
        validateSkinDimensions(image.naturalWidth, image.naturalHeight);
        return images.variant(image);
      },
      "errors.failedDetectSkinType",
    );
  },
);

const browserImages: Context.Service.Shape<typeof SkinImages> = {
  create: () => new Image(),
  variant: (image) => {
    if (image.naturalWidth === image.naturalHeight * 2) return "classic";
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new MessageError("errors.canvasUnavailable");
    canvas.width = 64;
    canvas.height = 64;
    ctx.drawImage(image, 0, 0, 64, 64);
    return detectVariantFromPixels(ctx.getImageData(0, 0, 64, 64).data);
  },
};

const browserObjectUrls = {
  create: (blob: File) => URL.createObjectURL(blob),
  revoke: (url: string) => {
    URL.revokeObjectURL(url);
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
  urls = browserObjectUrls,
) {
  return Effect.acquireUseRelease(
    Effect.try({
      try: () => urls.create(file),
      catch: (cause) =>
        SkinImageError.make({
          ...messageFields("common.failedLoadImage"),
          cause,
        }),
    }),
    (url) =>
      detectSkinVariantEffect(url).pipe(
        Effect.flatMap((variant) =>
          Effect.gen(function* () {
            yield* Effect.sync(() => {
              events.preview(url);
              events.detected(variant);
            });
            // The component displays this URL until the next selection.
            return yield* Effect.never;
          }),
        ),
        Effect.catch((cause) =>
          Effect.sync(() => {
            events.failed(cause);
          }),
        ),
      ),
    (url) =>
      Effect.sync(() => {
        urls.revoke(url);
      }),
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

export function isValidSkinName(name: string): boolean {
  return /^[a-z0-9_]+$/u.test(name);
}
