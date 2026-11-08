import { Generator, getConfig } from "@tanstack/router-generator";
import { Effect } from "effect";
import { toolOperation } from "./lib/runtime";

await Effect.runPromise(
  toolOperation("generate TanStack routes", () =>
    new Generator({ config: getConfig(), root: process.cwd() }).run(),
  ),
);
