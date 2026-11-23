import assert from "node:assert/strict";
import { test } from "node:test";
import { pageHasLocale, suggestedLocale } from "./language-suggestion";

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

test("docs pages are offered only in the locales they are written in", () => {
  const docs = [
    { loaderData: undefined },
    { loaderData: { alternatives: ["en", "ru"] } },
  ];
  assert.equal(pageHasLocale("/docs/installation#setup", "ru", docs), true);
  assert.equal(pageHasLocale("/docs/installation", "es", docs), false);
  assert.equal(pageHasLocale("/es/docs", "ru", docs), true);
  assert.equal(pageHasLocale("/docs/troubleshooting", "ru", []), false);
});

test("tool pages exist in every locale and legal pages in none", () => {
  assert.equal(pageHasLocale("/studio?handoff=abc", "pt-BR", []), true);
  assert.equal(pageHasLocale("/", "es", []), true);
  assert.equal(pageHasLocale("/privacy-policy", "ru", []), false);
});
