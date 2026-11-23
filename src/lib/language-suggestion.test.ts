import assert from "node:assert/strict";
import { test } from "node:test";
import { lastLocale, rememberLocale } from "./i18n";
import {
  languageOffer,
  pageHasLocale,
  recordLanguageAnswer,
  suggestedLocale,
} from "./language-suggestion";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
  };
}

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
  assert.equal(pageHasLocale("/studio?skin=abc", "pt-BR", []), true);
  assert.equal(pageHasLocale("/", "es", []), true);
  assert.equal(pageHasLocale("/privacy-policy", "ru", []), false);
});

test("picking a language in the switcher ends the browser-language offer", () => {
  const storage = memoryStorage();
  const english = ["en-US"];
  assert.equal(languageOffer(storage, english, "es"), "en");
  // An English browser picks Español: the Spanish page must not offer English.
  recordLanguageAnswer(storage, "chose");
  assert.equal(languageOffer(storage, english, "es"), undefined);
  assert.equal(languageOffer(storage, ["ru"], "en"), undefined);
});

test("the offer never shows without working storage", () => {
  const blocked = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  assert.equal(languageOffer(undefined, ["ru"], "en"), undefined);
  assert.equal(languageOffer(blocked, ["ru"], "en"), undefined);
  recordLanguageAnswer(blocked, "dismissed");
});

test("the last localized locale survives for English-only pages", () => {
  const storage = memoryStorage();
  assert.equal(lastLocale(storage), undefined);
  rememberLocale(storage, "ru");
  assert.equal(lastLocale(storage), "ru");
  storage.setItem("skinsrestorer:locale", "de");
  assert.equal(lastLocale(storage), undefined);
});
