import type { LLMsOptions } from "fumadocs-core/mdx-plugins/remark-llms";
import { replaceSource } from "fumadocs-core/mdx-plugins/stringifier";
import type { Nodes, Root } from "mdast";
import type { VFile } from "vfile";

/**
 * Preserve related guide links, tab labels, and accordion titles in both
 * search records and Markdown exports.
 */
export function remarkDocsStringify() {
  return (tree: Root, file: VFile) => {
    function visit(node: Nodes, last = true) {
      if ("children" in node) {
        for (const [index, child] of node.children.entries()) {
          visit(child, index === node.children.length - 1);
        }
      }
      if (
        (node.type !== "mdxJsxFlowElement" &&
          node.type !== "mdxJsxTextElement") ||
        !labeledElements.has(node.name ?? "")
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
      let label: string | undefined;
      if (node.name === "Tab") {
        const value = attribute("value");
        label = value ? `**${value}**` : undefined;
      } else if (node.name === "Accordion") {
        // A collapsed section reads as a subsection in plain Markdown.
        const title = attribute("title");
        label = title ? `### ${title}` : undefined;
      } else {
        const title = attribute("title") ?? "Related guide";
        const href = attribute("href");
        label = href ? `[${title}](${href})` : title;
      }
      // Sibling cards and tabs sit on adjacent source lines. A block element
      // followed by another one ends with a newline, so the next one starts a
      // new paragraph instead of joining this content.
      const end = node.type === "mdxJsxFlowElement" && !last ? "\n" : "";
      replaceSource(file, node, (stringifier) => {
        const content = stringifier.inner(node).trim();
        if (!label) return `${content}${end}`;
        return `${content ? `${label}\n\n${content}` : label}${end}`;
      });
    }
    visit(tree);
  };
}

/** Elements whose label attribute is written before their content. */
const labeledElements = new Set(["Accordion", "Card", "Tab"]);

/** Keep navigation components readable in search and Markdown exports. */
export const docsStringify = {
  filterElement(node) {
    if (node.type === "mdxjsEsm") return false;
    if (
      node.type === "mdxJsxFlowElement" ||
      node.type === "mdxJsxTextElement"
    ) {
      return labeledElements.has(node.name ?? "") ? true : "children-only";
    }
    return true;
  },
} satisfies LLMsOptions;
