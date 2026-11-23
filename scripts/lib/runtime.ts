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
import {
  Cause,
  Console,
  Context,
  Effect,
  Exit,
  Fiber,
  Layer,
  Schema,
} from "effect";
import type { HttpClient } from "../../src/lib/effect-http";
import { httpClientLayer } from "../../src/lib/effect-http";

// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is a class factory.
export class ToolError extends Schema.TaggedError<
  ToolError,
  { readonly brand: unique symbol }
>()("ToolError", {
  operation: Schema.String,
  cause: Schema.Unknown,
}) {
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
    catch: (cause) => ToolError.make({ operation, cause }),
  }).pipe(Effect.uninterruptible);
}
export const toolTry = <A>(operation: string, work: () => A) =>
  Effect.try({
    try: work,
    catch: (cause) => ToolError.make({ operation, cause }),
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
    Effect.tryPromise({
      try: () => access(file),
      catch: (cause) => ToolError.make({ operation: "check file", cause }),
    }).pipe(Effect.isSuccess),
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
  "skinsrestorer.net/scripts/lib/runtime/ToolFiles",
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

/**
 * Windows does not kill grandchildren with their parent, so a killed
 * `cmd.exe` would leave the JVM it started running.
 */
async function killTree(pid: number | undefined, kill: () => void) {
  if (process.platform !== "win32" || pid === undefined) {
    kill();
    return;
  }
  await new Promise<void>((resolve) => {
    const taskkill = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], {
      stdio: "ignore",
    });
    taskkill.once("error", () => {
      kill();
      resolve();
    });
    taskkill.once("close", () => {
      resolve();
    });
  });
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
        child.once("close", (code) => {
          resolve(code ?? 1);
        });
      });
      // Register rejection handling before an early spawn error can escape.
      void exit.catch(() => {});
      return { child, exit };
    }),
    ({ exit }) =>
      Effect.tryPromise({
        try: () => exit,
        catch: (cause) => ToolError.make({ operation: "run compiler", cause }),
      }),
    ({ child, exit }) =>
      Effect.promise(async () => {
        if (child.exitCode === null && child.signalCode === null)
          await killTree(child.pid, () => {
            child.kill("SIGKILL");
          });
        await exit.catch(() => {});
      }),
  );
});

const interruptSignals = ["SIGINT", "SIGTERM"] as const;
const signalExitCodes = { SIGINT: 130, SIGTERM: 143 } as const;

/**
 * Run a script's main program. SIGINT and SIGTERM interrupt the program and
 * wait for its finalizers, so temporary directories and child processes are
 * cleaned up before the process exits. A second signal exits immediately.
 */
export async function runTool<A, E>(
  program: Effect.Effect<A, E, ToolFiles | HttpClient>,
  report: (value: A) => void,
) {
  const fiber = Effect.runFork(
    program.pipe(Effect.provide([toolFilesLayer, httpClientLayer])),
  );
  let received: (typeof interruptSignals)[number] | undefined;
  const handlers = interruptSignals.map((signal) => {
    const handler = () => {
      if (received) {
        process.exit(signalExitCodes[signal]);
      }
      received = signal;
      Effect.runFork(Fiber.interrupt(fiber));
    };
    process.on(signal, handler);
    return () => {
      process.off(signal, handler);
    };
  });
  const exit = await Effect.runPromise(Fiber.await(fiber));
  for (const remove of handlers) remove();

  if (Exit.isSuccess(exit)) {
    report(exit.value);
  } else if (received && Cause.hasInterruptsOnly(exit.cause)) {
    process.exitCode = signalExitCodes[received];
  } else {
    const cause = Cause.squash(exit.cause);
    await Effect.runPromise(
      Console.error(cause instanceof Error ? cause.message : String(cause)),
    );
    process.exitCode = 1;
  }
}
