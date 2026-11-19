import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { blurhashToDataUri } from "@unpic/placeholder";
import { encode } from "blurhash";
import { Effect, Schema } from "effect";
import sharp from "sharp";
import type { StaticImageManifest } from "../../src/lib/static-images";

// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is a class factory.
class StaticImageError extends Schema.TaggedError<
  StaticImageError,
  { readonly brand: unique symbol }
>()("StaticImageError", {
  operation: Schema.String,
  cause: Schema.Unknown,
}) {
  override get message() {
    return `${this.operation}: ${this.cause instanceof Error ? this.cause.message : String(this.cause)}`;
  }
}

// Keep encoding bounded even on build machines with many CPU cores.
sharp.concurrency(1);
const largestWidth = 1920;
const widths = [48, 96, 192, 384, 768, 1280, largestWidth];
const outputName = "_images";

export function generateStaticImages({
  publicDirectory,
  metadataFile,
  preserveSources = [],
}: {
  publicDirectory: URL;
  metadataFile: URL;
  preserveSources?: readonly string[];
}) {
  return Effect.gen(function* () {
    const directory = fileURLToPath(publicDirectory);
    const output = join(directory, outputName);
    const files = (yield* listFiles(directory))
      .filter((file) => {
        const source = relative(directory, file).replaceAll("\\", "/");
        return (
          !source.startsWith(`${outputName}/`) &&
          /\.(png|jpe?g|webp|gif|avif|svg)$/iu.test(source)
        );
      })
      .toSorted();
    yield* makeDirectory(output);
    const generated = new Set<string>();
    const entries = yield* Effect.forEach(
      files,
      (file) =>
        Effect.gen(function* () {
          const source = `/${relative(directory, file).replaceAll("\\", "/")}`;
          const bytes = yield* readBytes(file);
          const info = yield* operation(`read image metadata: ${source}`, () =>
            sharp(bytes).metadata(),
          );
          const rotated =
            info.orientation !== undefined &&
            info.orientation >= 5 &&
            info.orientation <= 8;
          const width = rotated ? info.height : info.width;
          const height = rotated ? info.width : info.height;
          if (!width || !height) {
            return yield* StaticImageError.make({
              operation: "read image dimensions",
              cause: source,
            });
          }
          const metadata: StaticImageManifest[string] = { width, height };
          if (
            info.format === "svg" ||
            info.format === "gif" ||
            (info.pages ?? 1) > 1 ||
            preserveSources.includes(source)
          )
            return [source, metadata] as const;

          const opaque = yield* operation(
            `inspect transparency: ${source}`,
            async () => (await sharp(bytes).stats()).isOpaque,
          );
          if (opaque) {
            metadata.background = yield* operation(
              `generate placeholder: ${source}`,
              async () => {
                const { data, info: pixels } = await sharp(bytes)
                  .rotate()
                  .resize(32, 32, { fit: "inside", withoutEnlargement: true })
                  .ensureAlpha()
                  .raw()
                  .toBuffer({ resolveWithObject: true });
                return blurhashToDataUri(
                  encode(
                    new Uint8ClampedArray(data),
                    pixels.width,
                    pixels.height,
                    4,
                    3,
                  ),
                );
              },
            );
          }
          const hash = createHash("sha256")
            .update(bytes)
            .update("static-webp-v1-quality85")
            .digest("hex")
            .slice(0, 20);
          const sizes = [
            ...new Set([
              ...widths.filter((size) => size < width),
              Math.min(width, largestWidth),
            ]),
          ];
          metadata.variants = yield* Effect.forEach(
            sizes,
            (size) =>
              Effect.gen(function* () {
                const name = `${hash}-${size}.webp`;
                const target = join(output, name);
                generated.add(name);
                if (!(yield* exists(target))) {
                  const buffer = yield* operation(
                    `resize image: ${source} (${size}px)`,
                    () =>
                      sharp(bytes)
                        .rotate()
                        .resize({ width: size, withoutEnlargement: true })
                        .webp({ quality: 85, effort: 4 })
                        .toBuffer(),
                  );
                  yield* writeBytes(target, buffer);
                }
                return { width: size, src: `/${outputName}/${name}` };
              }),
            { concurrency: 2 },
          );
          return [source, metadata] as const;
        }),
      { concurrency: 2 },
    );
    const manifest = Object.fromEntries(entries);
    const json = yield* Schema.encodeEffect(
      Schema.fromJsonString(Schema.Unknown, { space: 2 }),
    )(manifest);
    yield* writeText(fileURLToPath(metadataFile), `${json}\n`);
    const stale = (yield* listFiles(output)).filter(
      (file) => !generated.has(relative(output, file)),
    );
    yield* Effect.forEach(stale, removeFile, { concurrency: 4 });
    return { images: entries.length, variants: generated.size };
  });
}

import {
  nodeFiles,
  toolFilesLayer,
  toolOperation as operation,
  walkFiles,
} from "./runtime";
const readBytes = nodeFiles.readBytes;
const writeBytes = nodeFiles.writeBytes;
const writeText = nodeFiles.writeText;
const makeDirectory = nodeFiles.makeDirectory;
const exists = nodeFiles.exists;
const removeFile = nodeFiles.remove;
const listFiles = (directory: string) =>
  walkFiles(directory).pipe(Effect.provide(toolFilesLayer));
