import assert from "node:assert/strict";
import { test } from "node:test";
import { remarkLLMs } from "fumadocs-core/mdx-plugins/remark-llms";
import { remarkHeading } from "fumadocs-core/mdx-plugins/remark-heading";
import { remarkStructure } from "fumadocs-core/mdx-plugins/remark-structure";
import { remark } from "remark";
import remarkMdx from "remark-mdx";
import { VFile } from "vfile";
import { docsStringify, remarkDocsStringify } from "./docs-stringify";

function extract(markdown: string) {
  const file = new VFile(markdown);
  const processor = remark()
    .use(remarkMdx)
    .use(remarkDocsStringify)
    .use(remarkHeading)
    .use(remarkStructure, { mdxTypes: (node) => node.name === "Card" })
    .use(remarkLLMs, { ...docsStringify, _data: true });
  processor.runSync(processor.parse(file), file);
  return file.data;
}

test("related guide links retain their title, URL, and content in Markdown", () => {
  const result = extract(`import { Card } from "./components";

# Skin guides

<Cards>
  <Card title="Upload a skin" href="/docs/features/skin-upload">
    Choose a PNG file.
  </Card>
</Cards>`);
  assert.match(
    String(result.markdown),
    /\[Upload a skin\]\(\/docs\/features\/skin-upload\)/,
  );
  assert.match(String(result.markdown), /Choose a PNG file\./);
  assert.doesNotMatch(String(result.markdown), /import |<Cards|<Card/);
  assert.ok(result.structuredData);
  assert.deepEqual(result.structuredData.headings, [
    { id: "skin-guides", content: "Skin guides" },
  ]);
  assert.match(JSON.stringify(result.structuredData.contents), /Upload a skin/);
});

test("related guides without titles preserve the fallback label", () => {
  const result = extract('<Card href="/docs">Read the guide.</Card>');
  assert.match(String(result.markdown), /\[Related guide\]\(\/docs\)/);
  assert.match(String(result.markdown), /Read the guide\./);
});
