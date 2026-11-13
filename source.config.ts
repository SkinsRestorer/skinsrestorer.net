import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import lastModified from "fumadocs-mdx/plugins/last-modified";
import { docsFrontmatterSchema } from "./src/lib/docs-schema.ts";
import {
  docsStringify,
  remarkDocsStringify,
} from "./src/lib/docs-stringify.ts";
import { remarkDocsTableHeaders } from "./src/lib/docs-table-headers.ts";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: docsFrontmatterSchema,
    postprocess: {
      includeProcessedMarkdown: docsStringify,
      extractLinkReferences: true,
    },
  },
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: (plugins) => [
      remarkDocsTableHeaders,
      remarkDocsStringify,
      ...plugins,
    ],
    remarkStructureOptions: {
      types: (node) =>
        ["heading", "paragraph", "blockquote", "mdxJsxFlowElement"].includes(
          node.type,
        ) ||
        (node.type === "tableRow" && !node.data?.docsTableHeader),
      mdxTypes: (node) => node.name === "Card",
    },
    rehypeCodeOptions: {
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
      inline: "tailing-curly-colon",
    },
  },
  plugins: [lastModified()],
});
