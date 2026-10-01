import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import lastModified from "fumadocs-mdx/plugins/last-modified";
import { docsSchema } from "./src/lib/docs-schema";
import { docsStringify } from "./src/lib/docs-stringify";
import { remarkDocsTableHeaders } from "./src/lib/docs-table-headers";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: docsSchema,
    postprocess: {
      includeProcessedMarkdown: docsStringify,
      extractLinkReferences: true,
    },
  },
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: (plugins) => [remarkDocsTableHeaders, ...plugins],
    remarkStructureOptions: {
      types: (node) =>
        ["heading", "paragraph", "blockquote", "mdxJsxFlowElement"].includes(
          node.type,
        ) ||
        (node.type === "tableRow" && !node.data?.docsTableHeader),
      mdxTypes: (node) => node.name === "Card",
      stringify: docsStringify,
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
