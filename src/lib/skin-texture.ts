import { Data, Effect } from "effect";
import { readHttpBytes } from "./effect-http";
import {
  importSkinPng,
  MAX_SKIN_FILE_BYTES,
  SkinFileError,
} from "./skin-document";

export const TEXTURE_HOST = "textures.minecraft.net";

export class TextureImportError extends Data.TaggedError("TextureImportError")<{
  readonly message: string;
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
      message:
        "Enter a texture hash or a https://textures.minecraft.net/texture/… URL.",
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
      message: `Only ${TEXTURE_HOST} texture URLs can be opened. For other sites, download the PNG and open it as a file.`,
    });
  const match = /^\/texture\/([0-9a-f]{32,64})$/i.exec(url.pathname);
  if (!match || url.search !== "" || url.hash !== "")
    throw new TextureImportError({
      message: `This ${TEXTURE_HOST} URL does not point to a texture.`,
    });
  const hash = match[1].toLowerCase();
  return { hash, url: `https://${TEXTURE_HOST}/texture/${hash}` };
}

/** Download a trusted texture and open it locally. Redirects are refused. */
export const loadTextureEffect = Effect.fn("Skin.loadTexture")(function* (
  reference: string,
) {
  const { hash, url } = yield* Effect.try({
    try: () => parseTextureReference(reference),
    catch: (cause) =>
      cause instanceof TextureImportError
        ? cause
        : new TextureImportError({ message: "Invalid texture.", cause }),
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
          message:
            cause.reason === "timeout"
              ? "The texture download took too long. Try again."
              : cause.reason === "response"
                ? "The texture is larger than 5 MB."
                : "The texture could not be downloaded. Check the hash and your connection.",
          cause,
        }),
    ),
  );
  if (!response.ok)
    return yield* new TextureImportError({
      message:
        response.status === 404
          ? "No texture exists for this hash."
          : `The texture server answered with status ${response.status}.`,
    });
  const imported = yield* Effect.tryPromise({
    try: () => importSkinPng(response.bytes),
    catch: (cause) =>
      new TextureImportError({
        message:
          cause instanceof SkinFileError
            ? cause.message
            : "The texture is not a valid skin PNG.",
        cause,
      }),
  });
  return { ...imported, hash };
});
