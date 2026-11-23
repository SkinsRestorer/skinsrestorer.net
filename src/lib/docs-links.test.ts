import assert from "node:assert/strict";
import { test } from "node:test";
import { loader } from "fumadocs-core/source";
import { resolveDocLinks } from "./docs-links";
import { i18n } from "./i18n";

const source = loader(
  {
    files: [
      { type: "page", path: "index.mdx", data: { title: "Docs" } },
      {
        type: "page",
        path: "installation/index.mdx",
        data: { title: "Install", description: "Set it up" },
      },
      {
        type: "page",
        path: "installation/index.ru.mdx",
        data: { title: "Установка", description: "Настройка" },
      },
      { type: "page", path: "features/skins.mdx", data: { title: "Skins" } },
    ],
  },
  { i18n, baseUrl: "/docs" },
);

const page = (references: string[]) => ({
  path: "index.mdx",
  data: { extractedReferences: references.map((href) => ({ href })) },
});

test("English links resolve to English pages", () => {
  const links = resolveDocLinks(source, page(["/docs/installation"]), "en");
  assert.deepEqual(links["/docs/installation"], {
    url: "/docs/installation",
    title: "Install",
    description: "Set it up",
  });
});

test("links in other locales resolve to the translated page", () => {
  const links = resolveDocLinks(source, page(["/docs/installation"]), "ru");
  assert.deepEqual(links["/docs/installation"], {
    url: "/ru/docs/installation",
    title: "Установка",
    description: "Настройка",
  });
});

test("links to untranslated pages resolve to the English fallback", () => {
  const links = resolveDocLinks(
    source,
    page(["/docs/features/skins#apply", "./features/skins.mdx"]),
    "es",
  );
  assert.deepEqual(links, {
    "/docs/features/skins#apply": {
      url: "/es/docs/features/skins#apply",
      title: "Skins",
    },
    "./features/skins.mdx": { url: "/es/docs/features/skins", title: "Skins" },
  });
});

test("unknown links have no preview", () => {
  const links = resolveDocLinks(
    source,
    page(["/docs/missing", "/pricing"]),
    "pt-BR",
  );
  assert.deepEqual(links, {});
});
