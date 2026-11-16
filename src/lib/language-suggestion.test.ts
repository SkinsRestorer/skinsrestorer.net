import assert from "node:assert/strict";
import { test } from "node:test";
import { suggestedLocale } from "./language-suggestion";

test("the first supported browser language decides the suggestion", () => {
  assert.equal(suggestedLocale(["ru-RU", "ru", "en-US"], "en"), "ru");
  assert.equal(suggestedLocale(["de-DE", "es-419", "en"], "en"), "es");
  assert.equal(suggestedLocale(["pt-PT"], "en"), "pt-BR");
  assert.equal(suggestedLocale(["en-GB", "ru"], "ru"), "en");
});

test("no suggestion when the page already matches or nothing is supported", () => {
  assert.equal(suggestedLocale(["en-US", "ru"], "en"), undefined);
  assert.equal(suggestedLocale(["ru"], "ru"), undefined);
  assert.equal(suggestedLocale(["de", "fr"], "en"), undefined);
  assert.equal(suggestedLocale([], "en"), undefined);
});
