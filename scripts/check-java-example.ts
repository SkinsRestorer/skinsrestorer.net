import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

// Compile the exact complete files readers copy, against real published APIs.
const source = await readFile(
  "content/docs/development/first-plugin.mdx",
  "utf8",
);
const expected = new Set([
  "pom.xml",
  "src/main/resources/plugin.yml",
  "src/main/java/example/ExampleSkinPlugin.java",
]);
const directory = await mkdtemp(path.join(tmpdir(), "sr-docs-java-"));
try {
  for (const match of source.matchAll(
    /```(?:xml|yaml|java) title="([^"]+)"\n([\s\S]*?)\n```/g,
  )) {
    if (!expected.delete(match[1]))
      throw new Error(`Unexpected or duplicate example file: ${match[1]}`);
    const file = path.join(directory, match[1]);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, match[2]);
  }
  if (expected.size)
    throw new Error(`Missing example files: ${[...expected].join(", ")}`);
  const status = await new Promise<number>((resolve, reject) => {
    const child = spawn(
      "mvn",
      ["--batch-mode", "--no-transfer-progress", "package"],
      {
        cwd: directory,
        stdio: "inherit",
      },
    );
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
  if (status !== 0)
    throw new Error(`Java example build failed with exit code ${status}`);
  console.log(
    "Compiled and packaged the documentation's complete Java example.",
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
