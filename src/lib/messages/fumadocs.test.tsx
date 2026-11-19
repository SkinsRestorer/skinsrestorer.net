import assert from "node:assert/strict";
import { test } from "bun:test";
import { FrameworkProvider } from "fumadocs-core/framework";
import {
  LanguageSelect,
  LanguageSelectText,
} from "fumadocs-ui/layouts/shared/slots/language-select";
import { RootProvider } from "fumadocs-ui/provider/base";
import { renderToStaticMarkup } from "react-dom/server";
import { localeNames, locales } from "../i18n";
import { fumadocsMessages } from "./fumadocs";

const router = { push: () => {}, refresh: () => {} };

function renderLanguageButton(locale: (typeof locales)[number]) {
  return renderToStaticMarkup(
    <FrameworkProvider
      usePathname={() => "/docs"}
      useParams={() => ({})}
      useRouter={() => router}
    >
      <RootProvider
        search={{ enabled: false }}
        i18n={{
          locale,
          locales: locales.map((code) => ({
            locale: code,
            name: localeNames[code],
          })),
          translations: fumadocsMessages(locale),
        }}
      >
        <LanguageSelect>
          <LanguageSelectText />
        </LanguageSelect>
      </RootProvider>
    </FrameworkProvider>,
  );
}

for (const locale of locales) {
  test(`the ${locale} language button name starts with its visible text`, () => {
    const html = renderLanguageButton(locale);
    const button =
      /<button[^>]*aria-label="([^"]*)"[^>]*>(.*?)<\/button>/u.exec(html);
    assert.ok(button, "language button not rendered");
    const [, name = "", content = ""] = button;
    const visibleText = content.replaceAll(/<[^>]+>/gu, "");
    assert.equal(visibleText, localeNames[locale]);
    assert.ok(
      name.startsWith(visibleText),
      `"${name}" does not start with "${visibleText}"`,
    );
  });
}
