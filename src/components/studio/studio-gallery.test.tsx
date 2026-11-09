import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/lib/i18n-react";
import type { GalleryState } from "@/lib/hooks/use-skin-gallery";
import { StudioGallery } from "./studio-gallery";

const skins = [
  {
    id: "forest-ranger",
    name: "Forest ranger",
    variant: "slim" as const,
    textureUrl: `https://textures.minecraft.net/texture/${"a".repeat(64)}`,
  },
];
const noop = () => {};
const render = (state: GalleryState, query = "", locale: "en" | "ru" = "en") =>
  renderToStaticMarkup(
    <LocaleProvider locale={locale}>
      <StudioGallery
        state={state}
        query={query}
        onQuery={noop}
        onRetry={noop}
        onSelect={noop}
        layout="rail"
      />
    </LocaleProvider>,
  );

test("gallery names and models have accessible labels without selecting an entry", () => {
  const html = render({ status: "ready", skins });
  assert.match(html, /aria-label="Forest ranger, Slim model"/);
  assert.doesNotMatch(html, /aria-current="true"/);
  assert.doesNotMatch(html, /No skins found/);
});

test("gallery search and failure states give concise localized feedback", () => {
  assert.match(
    render({ status: "ready", skins }, "absent"),
    /No skins found\./,
  );
  const error = render({ status: "error" }, "", "ru");
  assert.match(error, /Не удалось загрузить галерею/);
  assert.match(error, /Поиск в галерее/);
  assert.doesNotMatch(error, /The gallery could not be loaded/);
});
