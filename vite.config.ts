import { docsFunctionId, staticDocsMetadata } from "./scripts/static-docs.ts";
import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  docFileInfo,
  locales,
  localizePath,
  splitLocalePath,
} from "./src/lib/i18n.ts";
import { execFileSync } from "node:child_process";
import { cloudflare } from "@cloudflare/vite-plugin";
import posthog from "@posthog/rollup-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { defineConfig } from "vite";
import { localizedSitePages } from "./src/lib/site-pages.ts";
import { securityHeaders } from "./src/lib/security-headers.ts";
import * as MdxConfig from "./source.config.ts";

function getDocsPrerenderPages() {
  const directory = resolve(MdxConfig.docs.dir);
  const docs = readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.mdx?$/.test(entry.name))
    .map((entry) =>
      docFileInfo(relative(directory, join(entry.parentPath, entry.name))),
    );
  const paths = new Set(docs.map((doc) => doc.path));
  return [...paths].flatMap((path) =>
    locales.map((locale) => ({ path: localizePath(path, locale) })),
  );
}

export default defineConfig(({ command }) => ({
  server: { port: 3000, headers: securityHeaders },
  preview: { port: 3000, headers: securityHeaders },
  resolve: { tsconfigPaths: true },
  build: { sourcemap: true },
  environments: { ssr: { build: { sourcemap: true } } },
  plugins: [
    mdx(MdxConfig),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart({
      serverFns: { generateFunctionId: docsFunctionId },
      pages: [
        ...getDocsPrerenderPages(),
        ...localizedSitePages.map((path) => ({ path })),
        {
          path: "/api/search",
          prerender: { enabled: true, outputPath: "/api/search" },
          sitemap: { exclude: true },
        },
      ],
      prerender: {
        enabled: true,
        crawlLinks: true,
        autoSubfolderIndex: false,
        failOnError: true,
        concurrency: 4,
        filter: ({ path }) =>
          path === "/api/search" ||
          (!/[?#]/.test(path) &&
            (localizedSitePages.includes(path) ||
              ((splitLocalePath(path).path === "/docs" ||
                splitLocalePath(path).path.startsWith("/docs/")) &&
                !path.includes(".")))),
      },
    }),
    staticDocsMetadata(),
    react(),
    ...(command === "build" && process.env.POSTHOG_PERSONAL_API_KEY
      ? [
          {
            ...posthog({
              personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY,
              projectId: "101544",
              host: "https://eu.posthog.com",
              sourcemaps: {
                enabled: true,
                releaseName: "skinsrestorer.net",
                releaseVersion:
                  process.env.GITHUB_SHA ??
                  execFileSync("git", ["rev-parse", "HEAD"], {
                    encoding: "utf8",
                  }).trim(),
                deleteAfterUpload: true,
              },
            }),
            applyToEnvironment: (environment: { name: string }) =>
              environment.name === "client",
          },
        ]
      : []),
  ],
}));
