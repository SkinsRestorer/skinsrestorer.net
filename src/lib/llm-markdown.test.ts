import assert from "node:assert/strict";
import { test } from "node:test";
import {
  absoluteDocsUrl,
  formatExportedMarkdown as formatWithPage,
} from "./llm-markdown";
import type { Locale } from "./i18n";

const page = "https://skinsrestorer.net/docs/features/skin-editor";
const formatExportedMarkdown = (markdown: string, locale: Locale) =>
  formatWithPage(markdown, locale, page);

test("root-relative links become absolute in the reader's language", () => {
  assert.equal(
    formatExportedMarkdown(
      "Read [Velocity](/docs/installation/velocity#check) and [Terms](/terms).",
      "ru",
    ),
    "Read [Velocity](https://skinsrestorer.net/ru/docs/installation/velocity#check) and [Terms](https://skinsrestorer.net/terms).",
  );
});

test("external and protocol-relative links are unchanged", () => {
  const markdown =
    "[GitHub](https://github.com/SkinsRestorer) [CDN](//cdn.example)";
  assert.equal(formatExportedMarkdown(markdown, "es"), markdown);
});

test("anchor links point at the section on the HTML page", () => {
  // llms-full.txt joins every page, so a bare #privacy would be ambiguous.
  assert.equal(
    formatExportedMarkdown("Read [Privacy](#privacy).", "en"),
    `Read [Privacy](${page}#privacy).`,
  );
});

test("heading IDs are removed from headings", () => {
  assert.equal(
    formatExportedMarkdown(
      "## Before you switch [#before-you-switch]\n\nText [#kept]",
      "en",
    ),
    "## Before you switch\n\nText [#kept]",
  );
});

test("code blocks are unchanged", () => {
  const markdown = [
    "```md",
    "## Example [#example]",
    "[Link](/docs/installation)",
    "```",
    "[Link](/docs/installation)",
  ].join("\n");
  assert.deepEqual(formatExportedMarkdown(markdown, "en").split("\n"), [
    "```md",
    "## Example [#example]",
    "[Link](/docs/installation)",
    "```",
    "[Link](https://skinsrestorer.net/docs/installation)",
  ]);
});

test("a longer fence is not closed by a shorter marker", () => {
  const markdown = "````md\n```\n[Link](/docs)\n````\n[Link](/docs)";
  assert.equal(
    formatExportedMarkdown(markdown, "en"),
    "````md\n```\n[Link](/docs)\n````\n[Link](https://skinsrestorer.net/docs)",
  );
});

test("page URLs keep the locale prefix once", () => {
  assert.equal(
    absoluteDocsUrl("/pt-BR/docs/installation", "pt-BR"),
    "https://skinsrestorer.net/pt-BR/docs/installation",
  );
  assert.equal(
    absoluteDocsUrl("/docs/installation.mdx"),
    "https://skinsrestorer.net/docs/installation.mdx",
  );
});
