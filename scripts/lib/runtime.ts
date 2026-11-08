import { spawn } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Context, Data, Effect, Layer } from "effect";
import { HttpClient, httpClientLayer } from "../../src/lib/effect-http";

export class ToolError extends Data.TaggedError("ToolError")<{
  readonly operation: string;
  readonly cause: unknown;
}> {
  override get message() {
    return `${this.operation}: ${this.cause instanceof Error ? this.cause.message : String(this.cause)}`;
  }
}
export function toolOperation<A>(
  operation: string,
  work: () => PromiseLike<A>,
) {
  return Effect.tryPromise({
    try: async () => work(),
    catch: (cause) => new ToolError({ operation, cause }),
  }).pipe(Effect.uninterruptible);
}
export const toolTry = <A>(operation: string, work: () => A) =>
  Effect.try({
    try: work,
    catch: (cause) => new ToolError({ operation, cause }),
  });

export const nodeFiles = {
  readText: (file: string | URL) =>
    toolOperation("read file", () => readFile(file, "utf8")),
  readBytes: (file: string | URL) =>
    toolOperation("read file", () => readFile(file)),
  list: (directory: string) =>
    toolOperation("list directory", async () =>
      (await readdir(directory, { withFileTypes: true })).map((entry) => ({
        name: entry.name,
        directory: entry.isDirectory(),
      })),
    ),
  exists: (file: string) =>
    Effect.tryPromise(() => access(file)).pipe(
      Effect.match({ onSuccess: () => true, onFailure: () => false }),
    ),
  makeTemp: (prefix: string) =>
    toolOperation("create temporary directory", () =>
      mkdtemp(path.join(tmpdir(), prefix)),
    ),
  makeDirectory: (directory: string) =>
    toolOperation("create directory", () =>
      mkdir(directory, { recursive: true }),
    ),
  writeText: (file: string, content: string) =>
    toolOperation("write file", () => writeFile(file, content)),
  writeBytes: (file: string, content: Uint8Array) =>
    toolOperation("write file", () => writeFile(file, content)),
  remove: (directory: string) =>
    toolOperation("remove directory", () =>
      rm(directory, { recursive: true, force: true }),
    ),
};
export class ToolFiles extends Context.Service<ToolFiles, typeof nodeFiles>()(
  "skinsrestorer/ToolFiles",
) {}
export const toolFilesLayer = Layer.succeed(ToolFiles, nodeFiles);

export const walkFiles = Effect.fn("Docs.walkFiles")(function* (
  directory: string,
): Effect.fn.Return<string[], ToolError, ToolFiles> {
  const files = yield* ToolFiles;
  const entries = yield* files.list(directory);
  const children = yield* Effect.forEach(
    entries,
    (entry) =>
      entry.directory
        ? walkFiles(path.join(directory, entry.name))
        : Effect.succeed([path.join(directory, entry.name)]),
    { concurrency: 4 },
  );
  return children.flat();
});

export function withTemporaryDirectory<A, E, R>(
  prefix: string,
  use: (directory: string) => Effect.Effect<A, E, R>,
) {
  return Effect.flatMap(ToolFiles, (files) =>
    Effect.acquireUseRelease(files.makeTemp(prefix), use, files.remove),
  );
}

/** Kill and reap an interrupted compiler before its temporary files are removed. */
export const runChild = Effect.fn("Docs.runChild")(function* (
  command: string,
  args: string[],
  cwd: string,
) {
  return yield* Effect.acquireUseRelease(
    toolTry("start compiler", () => {
      const child = spawn(command, args, { cwd, stdio: "inherit" });
      const exit = new Promise<number>((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code) => resolve(code ?? 1));
      });
      // Register rejection handling before an early spawn error can escape.
      void exit.catch(() => undefined);
      return { child, exit };
    }),
    ({ exit }) =>
      Effect.tryPromise({
        try: () => exit,
        catch: (cause) => new ToolError({ operation: "run compiler", cause }),
      }),
    ({ child, exit }) =>
      Effect.promise(async () => {
        if (child.exitCode === null && child.signalCode === null)
          child.kill("SIGKILL");
        await exit.catch(() => undefined);
      }),
  );
});

export async function runTool<A, E>(
  program: Effect.Effect<A, E, ToolFiles | HttpClient>,
  report: (value: A) => void,
) {
  try {
    report(
      await Effect.runPromise(
        program.pipe(
          Effect.provide(Layer.mergeAll(toolFilesLayer, httpClientLayer)),
        ),
      ),
    );
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : String(cause));
    process.exitCode = 1;
  }
}
