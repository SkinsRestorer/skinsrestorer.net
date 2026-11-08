import * as entrypoint from "./src/server.ts" with { type: "cf-worker" };
import { defineConfig } from "cf/config";

export default defineConfig({
  accountId:
    process.env.CLOUDFLARE_ACCOUNT_ID ?? "ba673a702aa9c7a8f9a68449adf70951",
  worker: {
    name: "skinsrestorer-website",
    compatibilityDate: "2026-04-13",
    compatibilityFlags: ["nodejs_compat"],
    entrypoint,
    assets: {
      htmlHandling: "drop-trailing-slash",
      runWorkerFirst: false,
    },
    observability: {
      enabled: true,
      logs: {
        enabled: true,
        headSamplingRate: 1,
        invocationLogs: true,
      },
      traces: {
        enabled: true,
        headSamplingRate: 0.05,
      },
    },
  },
});
