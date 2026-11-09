import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ModelSelector } from "@/components/model-selector";
import { SkinIssueAlerts } from "@/components/editor/skin-issue-alerts";
import {
  docFileInfo,
  isLocale,
  localizeHref,
  localizePath,
  locales,
  splitLocalePath,
} from "./i18n";
import { LocaleProvider } from "./i18n-react";
import { catalogs, translate } from "./messages";
import { getPageHead } from "./seo";

const noop = () => {};

test("locale URLs preserve English permalinks and handoff, texture and section references", () => {
  assert.equal(
    localizePath("/upload?handoff=abc#result", "ru"),
    "/ru/upload?handoff=abc#result",
  );
  assert.equal(
    localizePath("/ru/editor?texture=abc", "pt-BR"),
    "/pt-BR/editor?texture=abc",
  );
  assert.equal(
    localizePath("/pt-BR/docs/installation#before-you-start", "en"),
    "/docs/installation#before-you-start",
  );
  assert.equal(localizePath("/", "es"), "/es");
  assert.deepEqual(splitLocalePath("/pt-BR/docs/installation/"), {
    locale: "pt-BR",
    path: "/docs/installation",
  });
  assert.equal(isLocale("pt"), false);
  assert.equal(isLocale("pt-BR"), true);
  assert.equal(localizeHref("/api/search", "es"), "/api/search");
  assert.equal(localizeHref("/privacy-policy", "ru"), "/privacy-policy");
  assert.equal(
    localizeHref("https://example.com/docs", "ru"),
    "https://example.com/docs",
  );
  assert.equal(
    localizeHref("//example.com/editor", "es"),
    "//example.com/editor",
  );
});

test("Fumadocs filenames map locale suffixes and index files to stable slugs", () => {
  assert.deepEqual(docFileInfo("installation/index.ru.mdx"), {
    locale: "ru",
    path: "/docs/installation",
    slugs: ["installation"],
  });
  assert.deepEqual(docFileInfo("features/skin-editor.pt-BR.mdx"), {
    locale: "pt-BR",
    path: "/docs/features/skin-editor",
    slugs: ["features", "skin-editor"],
  });
  assert.deepEqual(docFileInfo("index.mdx"), {
    locale: "en",
    path: "/docs",
    slugs: [],
  });
});

test("every tool translation is self-canonical with reciprocal hreflang and an English x-default", () => {
  for (const locale of locales) {
    const head = getPageHead("/editor?texture=private#workspace", {
      locale,
      title: "Skin Editor",
    });
    const canonical = head.links.filter((link) => link.rel === "canonical");
    assert.deepEqual(canonical, [
      {
        rel: "canonical",
        href: `https://skinsrestorer.net${localizePath("/editor", locale)}`,
      },
    ]);
    assert.equal(
      head.links.filter((link) => link.rel === "alternate").length,
      5,
    );
    assert.ok(
      head.links.some(
        (link) =>
          "hrefLang" in link &&
          link.hrefLang === "x-default" &&
          link.href === "https://skinsrestorer.net/editor",
      ),
    );
    for (const other of locales)
      assert.ok(
        head.links.some(
          (link) =>
            "hrefLang" in link &&
            link.hrefLang === other &&
            link.href ===
              `https://skinsrestorer.net${localizePath("/editor", other)}`,
        ),
      );
    assert.ok(
      head.meta.some(
        (tag) =>
          "title" in tag &&
          tag.title === `${translate(locale, "Skin Editor")} - SR`,
      ),
    );
    assert.ok(
      head.meta.some(
        (tag) =>
          "property" in tag &&
          tag.property === "og:url" &&
          tag.content === canonical[0].href,
      ),
    );
  }
});

test("untranslated docs use the English canonical and never claim a missing translation", () => {
  const head = getPageHead("/ru/docs/development", {
    locale: "ru",
    contentLocale: "en",
    alternatives: ["en"],
    title: "Development",
  });
  assert.equal(
    head.links[0].href,
    "https://skinsrestorer.net/docs/development",
  );
  assert.ok(
    !head.links.some((link) => "hrefLang" in link && link.hrefLang === "ru"),
  );
  assert.ok(
    head.meta.some(
      (tag) =>
        "property" in tag &&
        tag.property === "og:locale" &&
        tag.content === "en_US",
    ),
  );
});

test("translation catalogs keep every message and interpolation parameter in each locale", () => {
  const keys = Object.keys(catalogs.ru).sort();
  for (const catalog of Object.values(catalogs)) {
    assert.deepEqual(Object.keys(catalog).sort(), keys);
    for (const [message, value] of Object.entries(catalog)) {
      assert.ok(value.trim(), message);
      const placeholders = (text: string) =>
        [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
      assert.deepEqual(placeholders(value), placeholders(message), message);
    }
  }
  assert.equal(
    translate("es", "Edit {name}", { name: "{private skin}" }),
    "Editar {private skin}",
  );
  assert.equal(
    translate("ru", "Unrecognized service error"),
    "Unrecognized service error",
  );
});

test("translated model controls retain identities and accessible arm-width labels", () => {
  const html = renderToStaticMarkup(
    <LocaleProvider locale="es">
      <ModelSelector value="slim" onValueChange={noop} />
    </LocaleProvider>,
  );
  assert.ok(
    html.includes("Clásica, 4 píxeles") ||
      html.includes("Clásica, brazos de 4 píxeles"),
  );
  assert.ok(html.includes("Delgada"));
  const slim = [...html.matchAll(/<button\b[^>]*>/g)].find((match) =>
    match[0].includes('aria-label="Delgada,'),
  );
  assert.ok(slim?.[0].includes('aria-pressed="true"'));
});

test("a clean localized editor renders no issue alert or empty space", () => {
  const html = renderToStaticMarkup(
    <LocaleProvider locale="ru">
      <SkinIssueAlerts
        issues={[]}
        highlighted={null}
        onHighlight={noop}
        onRepair={noop}
        onVariant={noop}
      />
    </LocaleProvider>,
  );
  assert.equal(html, "");
});
