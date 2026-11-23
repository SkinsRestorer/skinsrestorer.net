import assert from "node:assert/strict";
import { test } from "node:test";
import { findUnusedKeys, validateCatalogs } from "./validate";

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

test("unused key detection reads quoted keys and allows keys built at runtime", () => {
  const keys = ["editor.lighten", "editor.darken", "common.copy", "home.old"];
  const sources = [
    'announce(t(`editor.${next}`)); t("common.copy");',
    "const label = 'home.title';",
  ];
  assert.deepEqual(findUnusedKeys(keys, sources), [
    "editor.lighten",
    "editor.darken",
    "home.old",
  ]);
  assert.deepEqual(
    findUnusedKeys(keys, sources, ["editor.lighten", "editor.darken"]),
    ["home.old"],
  );
});
