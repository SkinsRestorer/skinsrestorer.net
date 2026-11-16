import {
  errorFields,
  messageFields,
  type LocalizedErrorFields,
} from "./messages";
import { Data, Effect, Semaphore } from "effect";
import { readHttpBytes } from "./effect-http";
import { readPngSize } from "./png";
import {
  importSkinPng,
  MAX_SKIN_FILE_BYTES,
  SkinFileError,
  validateEditorSkinSize,
} from "./skin-document";

export const TEXTURE_HOST = "textures.minecraft.net";

export class TextureImportError extends Data.TaggedError("TextureImportError")<{
  readonly message: string;
  readonly messageKey?: LocalizedErrorFields["messageKey"];
  readonly messageValues?: LocalizedErrorFields["messageValues"];
  readonly cause?: unknown;
}> {}

const hashPattern = /^[0-9a-f]{32,64}$/i;

/**
 * Accept a texture hash or a textures.minecraft.net texture URL. Every other
 * host is rejected, because only Mojang's texture server is trusted here.
 */
export function parseTextureReference(input: string): {
  readonly hash: string;
  readonly url: string;
} {
  const value = input.trim();
  if (hashPattern.test(value)) {
    const hash = value.toLowerCase();
    return { hash, url: `https://${TEXTURE_HOST}/texture/${hash}` };
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TextureImportError({
      ...messageFields("texture.enterTextureHashHttpsTexturesMinecraftNet"),
    });
  }
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.hostname.toLowerCase() !== TEXTURE_HOST ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== ""
  )
    throw new TextureImportError({
      ...messageFields("common.onlyTexturesMinecraftNetTextureUrlsCan"),
    });
  const match = /^\/texture\/([0-9a-f]{32,64})$/i.exec(url.pathname);
  if (!match || url.search !== "" || url.hash !== "")
    throw new TextureImportError({
      ...messageFields("common.texturesMinecraftNetUrlDoesNotPoint"),
    });
  const hash = match[1].toLowerCase();
  return { hash, url: `https://${TEXTURE_HOST}/texture/${hash}` };
}

/** Download trusted texture bytes. Redirects are refused. */
const downloadTextureEffect = Effect.fn("Skin.downloadTexture")(function* (
  reference: string,
) {
  const { hash, url } = yield* Effect.try({
    try: () => parseTextureReference(reference),
    catch: (cause) =>
      cause instanceof TextureImportError
        ? cause
        : new TextureImportError({
            ...messageFields("texture.invalidTexture"),
            cause,
          }),
  });
  const response = yield* readHttpBytes(
    url,
    {
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      cache: "force-cache",
    },
    { timeoutMs: 15_000, maxBytes: MAX_SKIN_FILE_BYTES },
  ).pipe(
    Effect.mapError(
      (cause) =>
        new TextureImportError({
          ...messageFields(
            cause.reason === "timeout"
              ? "texture.textureDownloadTookTooLongTryAgain"
              : cause.reason === "response"
                ? "texture.textureLargerThan5Mb"
                : "texture.textureCouldNotDownloadedCheckHashConnection",
          ),
          cause,
        }),
    ),
  );
  if (!response.ok)
    return yield* new TextureImportError({
      ...messageFields(
        response.status === 404
          ? "texture.noTextureExistsHash"
          : "errors.textureStatus",
        { status: response.status },
      ),
    });
  return { hash, bytes: response.bytes };
});

/** Download a trusted texture and open it locally. Redirects are refused. */
export const loadTextureEffect = Effect.fn("Skin.loadTexture")(function* (
  reference: string,
) {
  const { hash, bytes } = yield* downloadTextureEffect(reference);
  const imported = yield* Effect.tryPromise({
    try: () => importSkinPng(bytes),
    catch: (cause) =>
      new TextureImportError({
        ...(cause instanceof SkinFileError
          ? errorFields(cause, "texture.textureNotValidSkinPng")
          : messageFields("texture.textureNotValidSkinPng")),
        cause,
      }),
  });
  return { ...imported, hash, bytes };
});

/** Thumbnail downloads share a few connections so visible items finish first. */
const previewPermits = Semaphore.makeUnsafe(6);

/**
 * Download a texture for display only. The PNG header and size are checked,
 * and the browser decodes the image. Opening a skin still uses
 * `loadTextureEffect`, which decodes and validates every pixel.
 */
export const loadTexturePreviewEffect = Effect.fn("Skin.loadTexturePreview")(
  function* (reference: string) {
    const { bytes } = yield* previewPermits.withPermits(1)(
      downloadTextureEffect(reference),
    );
    yield* Effect.try({
      try: () => {
        const { width, height } = readPngSize(bytes);
        validateEditorSkinSize(width, height);
      },
      catch: (cause) =>
        new TextureImportError({
          ...errorFields(cause, "texture.textureNotValidSkinPng"),
          cause,
        }),
    });
    return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "image/png" });
  },
);
