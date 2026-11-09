import assert from "node:assert/strict";
import { test } from "node:test";
import { validateCatalogs } from "./validate";

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
