import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findDuplicateValues,
  findUnusedKeys,
  validateCatalogs,
  validateRichNames,
} from "./validate";

test("catalog validation detects English keys, missing or extra messages and parameter drift", () => {
  assert.deepEqual(
    validateCatalogs({
      en: { "editor.greeting": "Hello {name}" },
      es: { "editor.greeting": "Hola {name}" },
    }),
    [],
  );
  const errors = validateCatalogs({
    en: { "editor.greeting": "Hello {name}", "English text": "Text" },
    es: { "editor.greeting": "Hola {nombre}", "editor.extra": "Extra" },
  });
  assert.ok(errors.includes("Invalid translation key: English text"));
  assert.ok(errors.includes("es: missing translation for English text"));
  assert.ok(errors.includes("es: unknown translation key editor.extra"));
  assert.ok(
    errors.includes("es: interpolation parameters differ for editor.greeting"),
  );
});

test("wording can change without renaming keys and empty translations fail", () => {
  assert.deepEqual(
    validateCatalogs({
      en: { "editor.greeting": "Welcome {name}!" },
      es: { "editor.greeting": "Hola {name}" },
    }),
    [],
  );
  assert.deepEqual(
    validateCatalogs({
      en: { "editor.greeting": "Welcome!" },
      es: { "editor.greeting": " " },
    }),
    ["es: missing translation for editor.greeting"],
  );
});

test("rich-text tags must match English and stay balanced", () => {
  const en = {
    "home.faq": "Read the <docs>guide</docs> or ask in <chat>Discord</chat>.",
  };
  assert.deepEqual(
    validateCatalogs({
      en,
      ru: {
        "home.faq":
          "Спросите в <chat>Discord</chat> или прочтите <docs>руководство</docs>.",
      },
    }),
    [],
  );
  assert.deepEqual(
    validateCatalogs({
      en,
      es: {
        "home.faq":
          "Lee la <guide>guía</guide> o pregunta en <chat>Discord</chat>.",
      },
      ru: {
        "home.faq": "Прочтите <docs>руководство</chat> в <chat>Discord</docs>.",
      },
    }),
    [
      "es: rich-text tags differ for home.faq",
      "ru: unbalanced rich-text tags in home.faq",
    ],
  );
});

test("translations cannot nest, move, or swap rich-text tags and placeholders", () => {
  const en = { "home.faq": "Read <a>the <b>guide</b></a> and {n} more." };
  const check = (translation: string) =>
    validateCatalogs({ en, ru: { "home.faq": translation } });
  assert.deepEqual(check("{n} more: <a><b>guide</b> here</a>."), []);
  for (const translation of [
    "Read <b>the <a>guide</a></b> and {n} more.",
    "Read <a>the</a> <b>guide</b> and {n} more.",
    "Read <a>the <b>guide</b> and {n}</a> more.",
  ])
    assert.deepEqual(check(translation), [
      "ru: rich-text tags differ for home.faq",
    ]);
});

test("rich message declarations must match the English tags and placeholders", () => {
  const english = { "home.faq": "Read <docs>the guide</docs> {count} times." };
  assert.deepEqual(
    validateRichNames(english, { "home.faq": ["count", "docs"] }),
    [],
  );
  assert.deepEqual(
    validateRichNames(english, {
      "home.faq": ["docs"],
      "home.gone": ["link"],
    }),
    [
      "Rich message home.faq declares docs, English has count,docs",
      "Unknown rich message key: home.gone",
    ],
  );
});

test("unused key detection reads quoted keys", () => {
  const keys = ["editor.lighten", "common.copy", "home.old"];
  const sources = [
    't(next === "lighten" ? "editor.lighten" : "editor.darken"); t("common.copy");',
    "const label = 'home.title';",
  ];
  assert.deepEqual(findUnusedKeys(keys, sources), ["home.old"]);
  assert.deepEqual(findUnusedKeys(["editor.face"], ["t(`editor.${next}`)"]), [
    "editor.face",
  ]);
});

test("duplicate detection groups keys with identical English values", () => {
  assert.deepEqual(
    findDuplicateValues({
      "nav.studio": "Skin Studio",
      "studio.title": "Skin Studio",
      "home.openStudio": "Open Skin Studio",
      "common.saved": "Saved",
      "studio.saved": "Saved.",
    }),
    [["Skin Studio", ["nav.studio", "studio.title"]]],
  );
});
