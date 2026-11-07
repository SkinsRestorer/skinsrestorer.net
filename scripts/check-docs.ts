import { Effect, Schema } from "effect";
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
import { docsStringify } from "../src/lib/docs-stringify";
import { parseYaml, validateConfig } from "../src/lib/docs-validation";

const root = path.resolve("content/docs");
export const checkDocs = Effect.fn("Docs.check")(function* () {
  const fs = yield* ToolFiles;
  const errors: string[] = [];
  const parser = remark().use(remarkMdx).use(remarkGfm);

  for (const [file, expected] of Object.entries(release.websiteSources)) {
    const content = yield* fs.readBytes(file);
    const actual = createHash("sha256").update(content).digest("hex");
    if (actual !== expected) {
      errors.push(
        `${file}: review the upload/generator guides and update the website source inventory`,
      );
    }
  }

  function walk(node: Nodes, visitor: (node: Nodes) => void) {
    visitor(node);
    if ("children" in node) {
      for (const child of node.children) walk(child, visitor);
    }
  }

  const documents = new Map<
    string,
    { file: string; tree: Root; headings: Set<string>; body: string }
  >();
  const documentFiles = yield* walkFiles(root);
  for (const file of documentFiles.filter((file) => file.endsWith(".mdx"))) {
    const raw = yield* fs.readText(file);
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
    try {
      if (!match) throw new Error("Missing front matter");
      const metadata = Schema.decodeUnknownSync(docsSchema)(
        parseYaml(match[1]),
      );
      if (!(metadata.icon in icons)) {
        throw new Error(`Unknown sidebar icon ${metadata.icon}`);
      }
      if (metadata.version !== release.version) {
        throw new Error(
          `Page version differs from verified release ${release.version}`,
        );
      }
      const body = match[2];
      if (body.includes("—"))
        throw new Error("Replace em dashes with plain punctuation");
      const tree = parser.parse(body);
      const data = structure(body, [remarkMdx, remarkGfm], {
        stringify: docsStringify,
      });
      const relative = path.relative(root, file).replaceAll(path.sep, "/");
      const route =
        `/docs/${relative.replace(/(?:\/)?index\.mdx$|\.mdx$/g, "")}`.replace(
          /\/$/,
          "",
        );
      documents.set(route, {
        file,
        tree,
        headings: new Set(data.headings.map((heading) => heading.id)),
        body,
      });
    } catch (error) {
      errors.push(`${path.relative(root, file)}: ${String(error)}`);
    }
  }

  const homeRoutes = new Set(
    (yield* walkFiles(path.resolve("src/app/(home)")))
      .filter((file) => /\/page\.(tsx|mdx)$/.test(file))
      .map(
        (file) =>
          `/${path.relative("src/app/(home)", path.dirname(file))}`.replace(
            /\/$/,
            "",
          ) || "/",
      ),
  );
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
    if (/^(?:https?:|mailto:|tel:)/.test(href)) return;
    if (!href) return;
    const url = new URL(href, `https://skinsrestorer.net${current}`);
    const route = decodeURI(url.pathname).replace(/\/$/, "") || "/";
    const target = redirects.get(route) ?? route;
    if (target.startsWith("/docs")) {
      const page = documents.get(target);
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
      /\.(png|jpg|jpeg|webp|svg|gif)$/.test(route)
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
        codeValues.add(node.value.replaceAll("\\|", "|"));
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
    const row = tableRows.find((row) => row[0] === property.key);
    if (!row) errors.push(`Missing reference row for ${property.key}`);
    else if (
      JSON.stringify(JSON.parse(row[2])) !== JSON.stringify(property.default)
    ) {
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

  for (const file of documentFiles.filter((file) =>
    file.endsWith("meta.json"),
  )) {
    const raw = yield* fs.readText(file);
    const metadata = yield* toolTry("parse navigation", () =>
      metaSchema.parse(JSON.parse(raw)),
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
      if (!documentFiles.includes(path.join(directory, "index.mdx"))) {
        errors.push(`${location}: missing folder overview`);
      }
    }
    for (const entry of metadata.pages ?? []) {
      if (entry.startsWith("---") || entry === "...") continue;
      const link = /^(?:\[([^\]]+)\])?\[[^\]]+\]\(([^)]+)\)$/.exec(entry);
      if (link) {
        if (!link[1] || !(link[1] in icons)) {
          errors.push(
            `${location}: supply a valid icon for sidebar link ${entry}`,
          );
        }
        yield* checkLink(link[2], "/docs", location);
        continue;
      }
      const exists = documentFiles.some(
        (candidate) =>
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

if (import.meta.main)
  await runTool(checkDocs(), ({ errors, summary }) => {
    if (errors.length) {
      console.error(errors.join("\n"));
      process.exitCode = 1;
    } else console.log(summary);
  });
