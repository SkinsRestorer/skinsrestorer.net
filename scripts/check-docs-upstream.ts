import { createHash } from "node:crypto";
import { Effect, Schema } from "effect";
import release from "../documentation/verified-release.json";
import { readHttpText } from "../src/lib/effect-http";
import { runTool, toolTry } from "./lib/runtime";

const treeSchema = Schema.Struct({
  truncated: Schema.Boolean,
  tree: Schema.Array(
    Schema.Struct({ path: Schema.String, type: Schema.String }),
  ),
});
const headers = { "User-Agent": "SkinsRestorer-Documentation-Check" };

/** Changed upstream declarations still require semantic review. */
export const checkDocsUpstream = Effect.fn("Docs.checkUpstream")(function* (
  version = release.version,
) {
  yield* toolTry("validate release version", () => {
    if (!/^\d+\.\d+\.\d+$/.test(version))
      throw new Error("Pass a release version, such as 15.12.6");
  });
  const treeResponse = yield* readHttpText(
    `https://api.github.com/repos/SkinsRestorer/SkinsRestorer/git/trees/${version}?recursive=1`,
    { headers },
    { maxBytes: 8 * 1024 * 1024 },
  );
  const tree = yield* toolTry("read upstream source tree", () => {
    if (!treeResponse.ok)
      throw new Error(`${treeResponse.status} while reading the source tree`);
    const tree = Schema.decodeUnknownSync(treeSchema)(
      JSON.parse(treeResponse.text),
    );
    if (tree.truncated)
      throw new Error("GitHub returned an incomplete source tree");
    return tree;
  });
  const known = new Set(Object.keys(release.sources));
  const changed = tree.tree
    .filter(
      (item) =>
        item.type === "blob" &&
        item.path.startsWith(
          "shared/src/main/java/net/skinsrestorer/shared/config/",
        ) &&
        item.path.endsWith("Config.java") &&
        !known.has(item.path),
    )
    .map((item) => `${item.path}: new configuration source`);
  const results = yield* Effect.forEach(
    Object.entries(release.sources),
    ([file, expected]) =>
      Effect.gen(function* () {
        const response = yield* readHttpText(
          `https://raw.githubusercontent.com/SkinsRestorer/SkinsRestorer/${version}/${file}`,
          { headers },
        );
        yield* toolTry("read upstream source", () => {
          if (!response.ok)
            throw new Error(`${response.status} while reading ${file}`);
        });
        return createHash("sha256").update(response.text).digest("hex") ===
          expected
          ? []
          : [`${file}: changed since ${release.version}`];
      }),
    { concurrency: 4 },
  );
  return {
    changed: [...changed, ...results.flat()],
    count: known.size,
    version,
  };
});
if (import.meta.main)
  await runTool(
    checkDocsUpstream(process.argv[2]),
    ({ changed, count, version }) => {
      if (changed.length) {
        console.error(changed.join("\n"));
        console.error(
          "Review these declarations and update the inventory and affected pages together.",
        );
        process.exitCode = 1;
      } else
        console.log(
          `Verified ${count} source files against release ${version}.`,
        );
    },
  );
