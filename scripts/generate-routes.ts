import { Generator, getConfig } from "@tanstack/router-generator";
import { Effect } from "effect";
import { toolOperation } from "./lib/runtime";

// The TanStack Start Vite plugin appends these Register types when it
// generates the route tree. Write the same footer here so install,
// typecheck and build all produce an identical routeTree.gen.ts.
const startRouteTreeFooter = [
  "import type { getRouter } from './router.tsx'",
  "import type { startInstance } from './start.ts'",
  "declare module '@tanstack/react-start' {",
  "  interface Register {",
  "    ssr: true",
  "    router: Awaited<ReturnType<typeof getRouter>>",
  "    config: Awaited<ReturnType<typeof startInstance.getOptions>>",
  "  }",
  "}",
].join("\n");

await Effect.runPromise(
  toolOperation("generate TanStack routes", () =>
    new Generator({
      config: getConfig({ routeTreeFileFooter: [startRouteTreeFooter] }),
      root: process.cwd(),
    }).run(),
  ),
);
