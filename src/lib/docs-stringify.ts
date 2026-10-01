import type { LLMsOptions } from "fumadocs-core/mdx-plugins/remark-llms";

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
  stringify(node, _parent, state, info) {
    if (
      node.type !== "mdxJsxFlowElement" &&
      node.type !== "mdxJsxTextElement"
    ) {
      return;
    }
    const content =
      node.type === "mdxJsxFlowElement"
        ? state.containerFlow(node, info)
        : state.containerPhrasing(node, info);
    if (node.name !== "Card") return content;
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
    return `${link}\n\n${content}`;
  },
} satisfies LLMsOptions;
