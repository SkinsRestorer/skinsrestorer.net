import { execFileSync } from "node:child_process";
import { cloudflare } from "@cloudflare/vite-plugin";
import posthog from "@posthog/rollup-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { defineConfig } from "vite";
import { sitePages } from "./src/lib/site-pages.ts";
import { securityHeaders } from "./src/lib/security-headers.ts";
import * as MdxConfig from "./source.config.ts";

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
      prerender: {
        enabled: true,
        crawlLinks: true,
        autoSubfolderIndex: false,
        failOnError: true,
        concurrency: 4,
        filter: ({ path }) =>
          !/[?#]/.test(path) &&
          ((sitePages as readonly string[]).includes(path) ||
            ((path === "/docs" || path.startsWith("/docs/")) &&
              !path.includes("."))),
      },
    }),
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
