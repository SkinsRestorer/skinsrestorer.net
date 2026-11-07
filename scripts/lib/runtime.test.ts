import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { Effect, Fiber } from "effect";
import {
  runChild,
  ToolFiles,
  toolFilesLayer,
  walkFiles,
  withTemporaryDirectory,
} from "./runtime";

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
        if (fail) return yield* Effect.fail(new Error("example failure"));
      }),
    );
    if (fail) await assert.rejects(run(program), /example failure/);
    else await run(program);
    await assert.rejects(access(directory));
  }
});

test("interrupted child processes are reaped before temporary directory cleanup", async () => {
  let directory = "";
  let pid = 0;
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
        yield* Effect.promise(async () => {
          for (let attempt = 0; attempt < 400; attempt++) {
            const current = await readFile(
              path.join(value, "ready"),
              "utf8",
            ).catch(() => null);
            if (current) {
              pid = Number(current);
              return;
            }
            await new Promise((resolve) => setTimeout(resolve, 5));
          }
          throw new Error("Child did not start");
        });
        yield* Fiber.interrupt(child);
        assert.throws(() => process.kill(pid, 0));
      }),
    ),
  );
  await assert.rejects(access(directory));
});

test("compiler exit status and missing-command errors remain observable", async () => {
  await run(
    withTemporaryDirectory("sr-effect-exit-", (directory) =>
      Effect.gen(function* () {
        assert.equal(
          yield* runChild(
            process.execPath,
            ["-e", "process.exit(3)"],
            directory,
          ),
          3,
        );
        const outcome = yield* Effect.result(
          runChild("sr-missing-test-compiler", [], directory),
        );
        assert.equal(outcome._tag, "Failure");
      }),
    ),
  );
});
