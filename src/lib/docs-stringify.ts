import type { LLMsOptions } from "fumadocs-core/mdx-plugins/remark-llms";
import { replaceSource } from "fumadocs-core/mdx-plugins/stringifier";
import type { Nodes, Root } from "mdast";
import type { VFile } from "vfile";

/** Preserve related guide links in both search records and Markdown exports. */
export function remarkDocsStringify() {
  return (tree: Root, file: VFile) => {
    function visit(node: Nodes) {
      if ("children" in node) node.children.forEach(visit);
      if (
        (node.type !== "mdxJsxFlowElement" &&
          node.type !== "mdxJsxTextElement") ||
        node.name !== "Card"
      ) {
        return;
      }
      const attribute = (name: string) => {
        const found = node.attributes.find(
          (item) => item.type === "mdxJsxAttribute" && item.name === name,
        );
        return found?.type === "mdxJsxAttribute" &&
          typeof found.value === "string"
          ? found.value
          : undefined;
      };
      const title = attribute("title") ?? "Related guide";
      const href = attribute("href");
      const link = href ? `[${title}](${href})` : title;
      replaceSource(file, node, (stringifier) => {
        const content = stringifier.inner(node).trim();
        return content ? `${link}\n\n${content}` : link;
      });
    }
    visit(tree);
  };
}

/** Keep navigation components readable in search and Markdown exports. */
export const docsStringify = {
  filterElement(node) {
    if (node.type === "mdxjsEsm") return false;
    if (
      node.type === "mdxJsxFlowElement" ||
      node.type === "mdxJsxTextElement"
    ) {
      return node.name === "Card" ? true : "children-only";
    }
    return true;
  },
} satisfies LLMsOptions;
