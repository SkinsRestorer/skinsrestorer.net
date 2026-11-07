import path from "node:path";
import { Effect } from "effect";
import {
  runChild,
  runTool,
  ToolFiles,
  toolTry,
  withTemporaryDirectory,
} from "./lib/runtime";

/** Compile exactly the complete files readers copy, against published APIs. */
export const checkJavaExample = Effect.fn("Docs.checkJavaExample")(
  function* () {
    const files = yield* ToolFiles;
    const source = yield* files.readText(
      "content/docs/development/first-plugin.mdx",
    );
    return yield* withTemporaryDirectory("sr-docs-java-", (directory) =>
      Effect.gen(function* () {
        const expected = new Set([
          "pom.xml",
          "src/main/resources/plugin.yml",
          "src/main/java/example/ExampleSkinPlugin.java",
        ]);
        for (const match of source.matchAll(
          /```(?:xml|yaml|java) title="([^"]+)"\n([\s\S]*?)\n```/g,
        )) {
          yield* toolTry("validate example files", () => {
            if (!expected.delete(match[1]))
              throw new Error(
                `Unexpected or duplicate example file: ${match[1]}`,
              );
          });
          const file = path.join(directory, match[1]);
          yield* files.makeDirectory(path.dirname(file));
          yield* files.writeText(file, match[2]);
        }
        yield* toolTry("validate example files", () => {
          if (expected.size)
            throw new Error(
              `Missing example files: ${[...expected].join(", ")}`,
            );
        });
        const status = yield* runChild(
          "mvn",
          ["--batch-mode", "--no-transfer-progress", "package"],
          directory,
        );
        yield* toolTry("compile Java example", () => {
          if (status !== 0)
            throw new Error(
              `Java example build failed with exit code ${status}`,
            );
        });
      }),
    );
  },
);
if (import.meta.main)
  await runTool(checkJavaExample(), () =>
    console.log(
      "Compiled and packaged the documentation's complete Java example.",
    ),
  );
