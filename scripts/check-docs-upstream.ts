import { createHash } from "node:crypto";
import release from "../documentation/verified-release.json";

// Read-only release comparison. Changed source requires human semantic review.
const version = process.argv[2] ?? release.version;
if (!/^\d+\.\d+\.\d+$/.test(version))
  throw new Error("Pass a release version, such as 15.12.6");
const changed: string[] = [];
async function get(url: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": "SkinsRestorer-Documentation-Check" },
  });
  if (!response.ok) throw new Error(`${response.status} while reading ${url}`);
  return response;
}
const treeResponse = await get(
  `https://api.github.com/repos/SkinsRestorer/SkinsRestorer/git/trees/${version}?recursive=1`,
);
const tree = (await treeResponse.json()) as {
  truncated: boolean;
  tree: { path: string; type: string }[];
};
if (tree.truncated)
  throw new Error("GitHub returned an incomplete source tree");
const configDir = "shared/src/main/java/net/skinsrestorer/shared/config/";
const known = new Set(Object.keys(release.sources));
const added = tree.tree.filter(
  (item) =>
    item.type === "blob" &&
    item.path.startsWith(configDir) &&
    item.path.endsWith("Config.java") &&
    !known.has(item.path),
);
changed.push(...added.map((item) => `${item.path}: new configuration source`));
for (const [file, expected] of Object.entries(release.sources)) {
  const response = await get(
    `https://raw.githubusercontent.com/SkinsRestorer/SkinsRestorer/${version}/${file}`,
  );
  const content = await response.text();
  const hash = createHash("sha256").update(content).digest("hex");
  if (hash !== expected)
    changed.push(`${file}: changed since ${release.version}`);
}
if (changed.length) {
  console.error(changed.join("\n"));
  console.error(
    "Review these declarations and update the inventory and affected pages together.",
  );
  process.exitCode = 1;
} else {
  console.log(
    `Verified ${known.size} source files against release ${version}.`,
  );
}
