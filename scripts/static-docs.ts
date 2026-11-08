import { createHash } from "node:crypto";
import { dirname, join, relative } from "node:path";
import { Effect } from "effect";
import { fromCrossJSON, toJSONAsync } from "seroval";
import { type Plugin, preview } from "vite";
import { readHttpText, runHttpEffect } from "../src/lib/effect-http.ts";
import { nodeFiles, toolFilesLayer, walkFiles } from "./lib/runtime.ts";

export const docsMetadataFunctionId = "docs-metadata";

export function docsFunctionId(options: {
  filename: string;
  functionName: string;
}) {
  if (
    options.filename.replaceAll("\\", "/").endsWith("/routes/docs/$.tsx") &&
    options.functionName === "serverLoader_createServerFn_handler"
  ) {
    return docsMetadataFunctionId;
  }
}

// Cloudflare prerenders in an isolated Worker, where TanStack's middleware cannot
// write to the host filesystem. Snapshot its public RPC through a local preview
// after prerendering, using the same Seroval JSON format as TanStack's static middleware.
export function staticDocsMetadata(): Plugin {
  return {
    name: "static-docs-metadata",
    enforce: "post",
    apply: "build",
    buildApp: {
      order: "post",
      async handler(builder) {
        const output = builder.environments.client?.config.build.outDir;
        if (!output) throw new Error("Client build output is unavailable");
        await Effect.runPromise(
          Effect.acquireUseRelease(
            Effect.tryPromise(() =>
              preview({
                configFile: builder.config.configFile,
                preview: { port: 0, open: false },
              }),
            ),
            (server) =>
              Effect.gen(function* () {
                const origin = server.resolvedUrls?.local[0];
                if (!origin)
                  throw new Error("Metadata preview URL is unavailable");
                const files = yield* walkFiles(output).pipe(
                  Effect.provide(toolFilesLayer),
                );
                const pages = files
                  .map((file) => relative(output, file).replaceAll("\\", "/"))
                  .filter(
                    (file) =>
                      file === "docs.html" ||
                      (file.startsWith("docs/") && file.endsWith(".html")),
                  )
                  .sort();
                if (!pages.length)
                  throw new Error("No prerendered documentation pages found");
                yield* Effect.forEach(
                  pages,
                  (page) =>
                    Effect.tryPromise(async () => {
                      const path = page.slice(0, -".html".length);
                      const slugs =
                        path === "docs"
                          ? []
                          : path
                              .slice("docs/".length)
                              .split("/")
                              .map(decodeURIComponent);
                      const payload = await toJSONAsync({ data: slugs });
                      const url = new URL(
                        `/_serverFn/${docsMetadataFunctionId}`,
                        origin,
                      );
                      url.searchParams.set("payload", JSON.stringify(payload));
                      const result = await runHttpEffect(
                        readHttpText(
                          url.href,
                          {
                            headers: {
                              "x-tsr-serverfn": "true",
                              accept: "application/json",
                              origin: new URL(origin).origin,
                              "sec-fetch-site": "same-origin",
                            },
                          },
                          { timeoutMs: 30_000, maxBytes: 32 * 1024 * 1024 },
                        ),
                      );
                      if (!result.ok)
                        throw new Error(
                          `Metadata request failed for /${path}: ${result.status}`,
                        );
                      const response = fromCrossJSON(
                        JSON.parse(result.text),
                        {},
                      );
                      if (
                        !response ||
                        typeof response !== "object" ||
                        ("error" in response && response.error !== undefined) ||
                        !("result" in response) ||
                        !response.result
                      ) {
                        throw new Error(
                          `Cannot snapshot docs metadata for /${path}`,
                        );
                      }
                      // Match the cache key of the pinned staticFunctionMiddleware.
                      // Slugs are string arrays, so no object-key sorting is needed.
                      const hash = JSON.stringify(slugs)
                        .replace(/[/\\?%*:|"<>]/g, "-")
                        .replace(/\s+/g, "_");
                      const key = createHash("sha1")
                        .update(`${docsMetadataFunctionId}__${hash}`)
                        .digest("hex");
                      const destination = join(
                        output,
                        "__tsr/staticServerFnCache",
                        `${key}.json`,
                      );
                      const json = JSON.stringify(await toJSONAsync(response));
                      await Effect.runPromise(
                        Effect.gen(function* () {
                          yield* nodeFiles.makeDirectory(dirname(destination));
                          yield* nodeFiles.writeText(destination, json);
                        }),
                      );
                    }),
                  { concurrency: 4 },
                );
                console.info(
                  `[static-docs] Wrote ${pages.length} metadata snapshots`,
                );
              }),
            (server) => Effect.promise(() => server.close()),
          ),
        );
      },
    },
  };
}
