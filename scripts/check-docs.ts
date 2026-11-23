import { docFileInfo, localizePath, splitLocalePath } from "../src/lib/i18n";
import { localizedSitePages } from "../src/lib/site-pages";
import { Console, Effect, Result, Schema } from "effect";
import {
  runTool,
  ToolFiles,
  toolTry,
  walkFiles,
  type ToolError,
} from "./lib/runtime";
import path from "node:path";
import { createHash } from "node:crypto";
import { structure } from "fumadocs-core/mdx-plugins/remark-structure";
import { metaSchema } from "fumadocs-core/source/schema";
import { icons } from "lucide-react";
import type { Nodes, Root } from "mdast";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import release from "../documentation/verified-release.json";
import { docsRedirects } from "../src/lib/docs-redirects";
import { docsSchema } from "../src/lib/docs-schema";
import { remarkDocsStringify } from "../src/lib/docs-stringify";
import { parseYaml, validateConfig } from "../src/lib/docs-validation";

const root = path.resolve("content/docs");
const inventoryFile = "documentation/verified-release.json";
const documentFilePattern = /\.mdx?$/u;

function parseDocument(
  parsers: ReturnType<typeof createParsers>,
  file: string,
  raw: string,
) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/u.exec(raw);
  if (!match) throw new Error("Missing front matter");
  const [, frontMatter = "", body = ""] = match;
  const metadata = Schema.decodeUnknownSync(docsSchema)(parseYaml(frontMatter));
  if (!(metadata.icon in icons)) {
    throw new Error(`Unknown sidebar icon ${metadata.icon}`);
  }
  if (metadata.version !== release.version) {
    throw new Error(
      `Page version differs from verified release ${release.version}`,
    );
  }
  if (body.includes("—"))
    throw new Error("Replace em dashes with plain punctuation");
  // Plain `.md` pages are not MDX, so `<` and `{` stay literal text.
  const mdx = file.endsWith(".mdx");
  const tree = (mdx ? parsers.mdx : parsers.md).parse(body);
  const data = structure(
    body,
    mdx ? [remarkMdx, remarkGfm, remarkDocsStringify] : [remarkGfm],
  );
  const relative = path.relative(root, file).replaceAll(path.sep, "/");
  const info = docFileInfo(relative);
  return {
    route: localizePath(info.path, info.locale),
    document: {
      file,
      tree,
      headings: new Set(data.headings.map((heading) => heading.id)),
      body,
    },
  };
}

function createParsers() {
  return {
    md: remark().use(remarkGfm),
    mdx: remark().use(remarkMdx).use(remarkGfm),
  };
}
function walk(node: Nodes, visitor: (node: Nodes) => void) {
  visitor(node);
  if ("children" in node) {
    for (const child of node.children) walk(child, visitor);
  }
}

const sourceTranspiler = new Bun.Transpiler({
  loader: "tsx",
  minifyWhitespace: true,
  trimUnusedImports: false,
  // Bun otherwise inlines the current NODE_ENV and drops the other branch, so
  // the hash would depend on the shell and miss changes to that branch.
  define: { "process.env.NODE_ENV": "process.env.NODE_ENV" },
  tsconfig: { compilerOptions: { jsx: "react-jsx" } },
});

/**
 * Hash the runtime code of a website source, not its text. Transpiling drops
 * comments, types, and formatting, so lint and format changes keep the hash.
 */
export function websiteSourceHash(source: string) {
  const code = sourceTranspiler
    .transformSync(source.replaceAll("\r\n", "\n"))
    // Bun suffixes its JSX runtime aliases with a build-specific tag.
    .replaceAll(/\b(jsxs?|jsxDEV|Fragment)_[\da-z]+\b/gu, "$1");
  return createHash("sha256").update(code).digest("hex");
}

const websiteSourceHashes = Effect.fn("Docs.websiteSourceHashes")(function* () {
  const fs = yield* ToolFiles;
  return yield* Effect.forEach(
    Object.keys(release.websiteSources),
    (file) =>
      Effect.flatMap(fs.readText(file), (source) =>
        toolTry(
          `normalize ${file}`,
          () => [file, websiteSourceHash(source)] as const,
        ),
      ),
    { concurrency: 8 },
  );
});

const changedWebsiteSources = (
  hashes: readonly (readonly [string, string])[],
) => {
  const reviewed: Record<string, string> = release.websiteSources;
  return hashes
    .filter(([file, hash]) => reviewed[file] !== hash)
    .map(([file]) => file);
};

/** List website sources that changed since the last guide review, or accept them. */
export const reviewWebsiteSources = Effect.fn("Docs.reviewWebsiteSources")(
  function* (accept: boolean) {
    const hashes = yield* websiteSourceHashes();
    const changed = changedWebsiteSources(hashes);
    if (accept && changed.length > 0) {
      const fs = yield* ToolFiles;
      const raw = yield* fs.readText(inventoryFile);
      const reviewed: Record<string, string> = release.websiteSources;
      // Replace only the changed hashes, so the formatted file keeps its layout.
      const updated = yield* toolTry("update website source inventory", () =>
        hashes.reduce((text, [file, hash]) => {
          const previous = reviewed[file];
          if (previous === hash) return text;
          const entry = `${encodeJson(file)}: ${encodeJson(previous)}`;
          if (text.split(entry).length !== 2)
            throw new Error(`Cannot find the inventory entry for ${file}`);
          return text.replace(
            entry,
            `${encodeJson(file)}: ${encodeJson(hash)}`,
          );
        }, raw),
      );
      yield* fs.writeText(inventoryFile, updated);
    }
    return changed;
  },
);

const decodeJson = Schema.decodeUnknownSync(
  Schema.fromJsonString(Schema.Unknown),
);
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

export const checkDocs = Effect.fn("Docs.check")(function* () {
  const fs = yield* ToolFiles;
  const errors: string[] = [];
  const parsers = createParsers();

  for (const file of yield* reviewWebsiteSources(false)) {
    errors.push(
      `${file}: behavior changed since the last guide review. Review the upload, generator, and editor guides, then run \`bun run docs:sources --accept\`.`,
    );
  }

  const documents = new Map<
    string,
    { file: string; tree: Root; headings: Set<string>; body: string }
  >();
  const documentFiles = yield* walkFiles(root);
  for (const file of documentFiles.filter((entry) =>
    documentFilePattern.test(entry),
  )) {
    const raw = yield* fs.readText(file);
    const parsed = yield* Effect.result(
      Effect.try({
        try: () => parseDocument(parsers, file, raw),
        catch: String,
      }),
    );
    if (Result.isFailure(parsed)) {
      errors.push(`${path.relative(root, file)}: ${parsed.failure}`);
    } else {
      // `page.md` and `page.mdx` map to the same route, and only one renders.
      const existing = documents.get(parsed.success.route);
      if (existing)
        errors.push(
          `${path.relative(root, file)}: duplicates ${path.relative(root, existing.file)}`,
        );
      documents.set(parsed.success.route, parsed.success.document);
    }
  }

  const homeRoutes = new Set<string>(localizedSitePages);
  const siteAliases = new Set([
    "/discord",
    "/github",
    "/donate",
    "/modrinth",
    "/spigot",
  ]);
  const redirects = new Map<string, string>(
    docsRedirects.map((item) => [item.source, item.destination]),
  );
  const checkLink = Effect.fn("Docs.checkLink")(function* (
    href: string,
    current: string,
    location: string,
  ) {
    if (/^(?:https?:|mailto:|tel:)/u.test(href)) return;
    if (!href) return;
    const url = new URL(href, `https://skinsrestorer.net${current}`);
    const route = decodeURI(url.pathname).replace(/\/$/u, "") || "/";
    const bare = splitLocalePath(route);
    const target = redirects.get(route) ?? route;
    const resolvedTarget = documents.has(target) ? target : bare.path;
    if (bare.path === "/docs" || bare.path.startsWith("/docs/")) {
      const page = documents.get(resolvedTarget);
      if (!page)
        errors.push(`${location}: missing documentation target ${href}`);
      else if (
        url.hash &&
        !page.headings.has(decodeURIComponent(url.hash.slice(1)))
      ) {
        errors.push(`${location}: missing anchor ${href}`);
      }
    } else if (
      route.startsWith("/assets/") ||
      /\.(png|jpg|jpeg|webp|svg|gif)$/u.test(route)
    ) {
      if (!(yield* fs.exists(path.join("public", route))))
        errors.push(`${location}: missing asset ${href}`);
    } else if (!homeRoutes.has(route) && !siteAliases.has(route)) {
      errors.push(`${location}: unknown site route ${href}`);
    }
  });
  const codeValues = new Set<string>();
  const tableRows: string[][] = [];
  for (const [route, document] of documents) {
    const checks: Effect.Effect<void, ToolError>[] = [];
    walk(document.tree, (node) => {
      const location = `${path.relative(root, document.file)}:${node.position?.start.line ?? 1}`;
      if (node.type === "link" || node.type === "image") {
        checks.push(checkLink(node.url, route, location));
      }
      if (
        node.type === "mdxJsxFlowElement" ||
        node.type === "mdxJsxTextElement"
      ) {
        for (const attribute of node.attributes) {
          if (
            attribute.type === "mdxJsxAttribute" &&
            ["href", "src"].includes(attribute.name) &&
            typeof attribute.value === "string"
          ) {
            checks.push(checkLink(attribute.value, route, location));
          }
        }
      }
      if (node.type === "inlineCode")
        codeValues.add(node.value.replaceAll(String.raw`\|`, "|"));
      if (node.type === "heading" && node.depth === 1) {
        errors.push(`${location}: use front matter for the page title`);
      }
      if (
        node.type === "code" &&
        node.lang === "yaml" &&
        node.meta?.includes("SkinsRestorer excerpt")
      ) {
        try {
          const invalid = validateConfig(parseYaml(node.value), release.config);
          errors.push(...invalid.map((error) => `${location}: ${error}`));
        } catch (error) {
          errors.push(`${location}: ${String(error)}`);
        }
      }
      if (node.type === "tableRow") {
        tableRows.push(
          node.children.map((cell) => {
            const values: string[] = [];
            walk(cell, (child) => {
              if (child.type === "inlineCode") values.push(child.value);
            });
            return values.join("");
          }),
        );
      }
    });
    yield* Effect.all(checks, { concurrency: 8 });
  }

  for (const property of release.config) {
    const row = tableRows.find((candidate) => candidate[0] === property.key);
    const value = row?.[2];
    if (!row) errors.push(`Missing reference row for ${property.key}`);
    else if (value === undefined)
      errors.push(`Missing reference default for ${property.key}`);
    else if (encodeJson(decodeJson(value)) !== encodeJson(property.default)) {
      errors.push(
        `Reference default differs from the inventory: ${property.key}`,
      );
    }
  }
  for (const permission of release.permissions) {
    if (!codeValues.has(permission))
      errors.push(`Missing permission reference: ${permission}`);
  }
  for (const command of release.commands) {
    const syntax = `/${command.root} ${command.syntax}`.trim();
    if (!codeValues.has(syntax))
      errors.push(`Missing command reference: ${syntax}`);
  }

  for (const file of documentFiles.filter((entry) =>
    /meta(?:\.(ru|es|pt-BR))?\.json$/u.test(entry),
  )) {
    const raw = yield* fs.readText(file);
    const metadata = yield* toolTry("parse navigation", () =>
      metaSchema.parse(
        Schema.decodeSync(Schema.fromJsonString(Schema.Unknown))(raw),
      ),
    );
    const directory = path.dirname(file);
    const location = path.relative(root, file);
    if (directory !== root) {
      if (!metadata.icon || !(metadata.icon in icons)) {
        errors.push(`${location}: supply a valid folder icon`);
      }
      if (metadata.pagesIndex !== "index") {
        errors.push(
          `${location}: use the overview as the clickable folder index`,
        );
      }
      if (metadata.pages?.includes(metadata.pagesIndex ?? "index")) {
        errors.push(
          `${location}: keep the folder index out of its child pages`,
        );
      }
      if (
        !documentFiles.some((candidate) =>
          [".md", ".mdx"].some(
            (extension) =>
              candidate === path.join(directory, `index${extension}`),
          ),
        )
      ) {
        errors.push(`${location}: missing folder overview`);
      }
    }
    for (const entry of metadata.pages ?? []) {
      if (entry.startsWith("---") || entry === "...") continue;
      const link = /^(?:\[([^\]]+)\])?\[[^\]]+\]\(([^)]+)\)$/u.exec(entry);
      if (link) {
        if (!link[1] || !(link[1] in icons)) {
          errors.push(
            `${location}: supply a valid icon for sidebar link ${entry}`,
          );
        }
        yield* checkLink(link[2] ?? "", "/docs", location);
        continue;
      }
      const exists = documentFiles.some(
        (candidate) =>
          candidate === path.join(directory, `${entry}.md`) ||
          candidate === path.join(directory, `${entry}.mdx`) ||
          candidate === path.join(directory, entry, "meta.json"),
      );
      if (!exists)
        errors.push(
          `${path.relative(root, file)}: missing sidebar entry ${entry}`,
        );
    }
  }
  for (const redirect of docsRedirects) {
    if (documents.has(redirect.source))
      errors.push(`Redirect shadows a page: ${redirect.source}`);
    if (!documents.has(redirect.destination))
      errors.push(`Missing redirect destination: ${redirect.destination}`);
  }
  return {
    errors,
    summary: `Validated ${documents.size} pages, ${release.config.length} configuration properties, ${release.commands.length} command forms, and ${release.permissions.length} permissions.`,
  };
});

const reportSources = (accept: boolean) => (changed: readonly string[]) => {
  if (changed.length === 0) {
    Effect.runSync(
      Console.log("Website sources match the reviewed inventory."),
    );
  } else if (accept) {
    Effect.runSync(
      Console.log(`Accepted reviewed website sources:\n${changed.join("\n")}`),
    );
  } else {
    Effect.runSync(
      Console.error(
        `Website sources changed since the last guide review:\n${changed.join("\n")}\nReview the affected guides, then run \`bun run docs:sources --accept\`.`,
      ),
    );
    process.exitCode = 1;
  }
};

if (import.meta.main && process.argv.includes("--sources")) {
  const accept = process.argv.includes("--accept");
  await runTool(reviewWebsiteSources(accept), reportSources(accept));
} else if (import.meta.main)
  await runTool(checkDocs(), ({ errors, summary }) => {
    if (errors.length > 0) {
      Effect.runSync(Console.error(errors.join("\n")));
      process.exitCode = 1;
    } else Effect.runSync(Console.log(summary));
  });
