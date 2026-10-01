import type { Nodes, Root } from "mdast";

declare module "mdast" {
  interface TableRowData {
    docsTableHeader?: boolean;
  }
}

/** Preserve table headers in Markdown, but exclude them from search records. */
export function remarkDocsTableHeaders() {
  return (tree: Root) => {
    function visit(node: Nodes) {
      if (node.type === "table" && node.children[0]) {
        const header = node.children[0];
        header.data = { ...header.data, docsTableHeader: true };
      }
      if ("children" in node) {
        for (const child of node.children) visit(child);
      }
    }
    visit(tree);
  };
}
