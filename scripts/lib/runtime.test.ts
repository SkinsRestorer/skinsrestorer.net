import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { Effect, Fiber } from "effect";
import {
  runChild,
  ToolError,
  ToolFiles,
  toolFilesLayer,
  walkFiles,
  withTemporaryDirectory,
} from "./runtime";

// Child processes can take seconds to start on a busy machine. These limits
// leave room for that and still fail a real hang well before CI times out.
const childStartLimit = 20_000;
const childTestTimeout = { timeout: 30_000 };

/** Wait for the test child to write its process ID to `ready`. */
async function readChildPid(directory: string) {
  for (let waited = 0; waited < childStartLimit; waited += 20) {
    const current = await readFile(path.join(directory, "ready"), "utf8").catch(
      () => null,
    );
    if (current) return Number(current);
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
  }
  throw new Error("Child did not start");
}

const run = <A, E>(program: Effect.Effect<A, E, ToolFiles>) =>
  Effect.runPromise(program.pipe(Effect.provide(toolFilesLayer)));

test("temporary directories are removed after successful and failed programs", async () => {
  for (const fail of [false, true]) {
    let directory = "";
    const program = withTemporaryDirectory("sr-effect-test-", (value) =>
      Effect.gen(function* () {
        directory = value;
        const files = yield* ToolFiles;
        yield* files.makeDirectory(path.join(value, "nested"));
        yield* files.writeText(
          path.join(value, "nested", "example.txt"),
          "example",
        );
        assert.equal((yield* walkFiles(value)).length, 1);
        return yield* fail
          ? ToolError.make({
              operation: "example",
              cause: new Error("example failure"),
            })
          : Effect.void;
      }),
    );
    if (fail) await assert.rejects(run(program), /example failure/u);
    else await run(program);
    await assert.rejects(access(directory));
  }
});

test(
  "interrupted child processes are reaped before temporary directory cleanup",
  childTestTimeout,
  async () => {
    let directory = "";
    await run(
      withTemporaryDirectory("sr-effect-child-", (value) =>
        Effect.gen(function* () {
          directory = value;
          const program = runChild(
            process.execPath,
            [
              "-e",
              "require('node:fs').writeFileSync('ready', String(process.pid)); setInterval(() => {}, 1000)",
            ],
            value,
          );
          const child = yield* Effect.forkChild(program);
          const pid = yield* Effect.promise(() => readChildPid(value));
          yield* Fiber.interrupt(child);
          assert.throws(() => process.kill(pid, 0));
        }),
      ),
    );
    await assert.rejects(access(directory));
  },
);

test(
  "compiler exit status and missing-command errors remain observable",
  childTestTimeout,
  async () => {
    await run(
      withTemporaryDirectory("sr-effect-exit-", (directory) =>
        Effect.gen(function* () {
          const exitCode = yield* runChild(
            process.execPath,
            ["-e", "process.exit(3)"],
            directory,
          );
          assert.equal(exitCode, 3);
          const outcome = yield* Effect.result(
            runChild("sr-missing-test-compiler", [], directory),
          );
          assert.equal(outcome._tag, "Failure");
        }),
      ),
    );
  },
);
