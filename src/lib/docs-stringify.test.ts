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
    String(result["markdown"]),
    /\[Upload a skin\]\(\/docs\/features\/skin-upload\)/u,
  );
  assert.match(String(result["markdown"]), /Choose a PNG file\./u);
  assert.doesNotMatch(String(result["markdown"]), /import |<Cards|<Card/u);
  assert.ok(result.structuredData);
  assert.deepEqual(result.structuredData.headings, [
    { id: "skin-guides", content: "Skin guides" },
  ]);
  assert.match(
    JSON.stringify(result.structuredData.contents),
    /Upload a skin/u,
  );
});

test("related guides without titles preserve the fallback label", () => {
  const result = extract('<Card href="/docs">Read the guide.</Card>');
  assert.match(String(result["markdown"]), /\[Related guide\]\(\/docs\)/u);
  assert.match(String(result["markdown"]), /Read the guide\./u);
});

test("each tab keeps its label before its content in Markdown", () => {
  const result = extract(`<Tabs items={['Kotlin', 'Groovy']}>
<Tab value="Kotlin">

\`\`\`kotlin
implementation("net.skinsrestorer:skinsrestorer-api:15.0.0")
\`\`\`

</Tab>
<Tab value="Groovy">

\`\`\`groovy
implementation 'net.skinsrestorer:skinsrestorer-api:15.0.0'
\`\`\`

</Tab>
</Tabs>`);
  const markdown = String(result["markdown"]);
  assert.match(
    markdown,
    /\*\*Kotlin\*\*\s+```kotlin\nimplementation\("net\.skinsrestorer/u,
  );
  assert.match(
    markdown,
    /\*\*Groovy\*\*\s+```groovy\nimplementation 'net\.skinsrestorer/u,
  );
  assert.ok(markdown.indexOf("**Kotlin**") < markdown.indexOf("**Groovy**"));
  assert.doesNotMatch(markdown, /<Tabs|<Tab/u);
});

test("consecutive related guides stay separate Markdown blocks", () => {
  const markdown = String(
    extract(`<Cards>
  <Card title="Install" href="/docs/installation">
    Choose your server.
  </Card>
  <Card title="Fix a problem" href="/docs/troubleshooting">
    Start with the symptom.
  </Card>
</Cards>

After the cards.`)["markdown"],
  );
  // A single newline would join a description and the next link into one
  // paragraph.
  assert.match(markdown, /Choose your server\.\n\n\[Fix a problem\]/u);
  assert.match(markdown, /Start with the symptom\.\n\nAfter the cards\./u);
});

test("consecutive tabs with prose stay separate Markdown blocks", () => {
  const markdown = String(
    extract(`<Tabs items={['Paper', 'Velocity']}>
<Tab value="Paper">
Use the Bukkit file.
</Tab>
<Tab value="Velocity">
Use the Velocity file.
</Tab>
</Tabs>`)["markdown"],
  );
  assert.match(markdown, /Use the Bukkit file\.\n\n\*\*Velocity\*\*/u);
});
