import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/lib/locale-provider";
import type { GalleryState } from "@/lib/hooks/use-skin-gallery";
import { galleryKeyTarget } from "./gallery-keys";
import { StudioGallery } from "./studio-gallery";

const skins = [
  {
    id: "forest-ranger",
    name: "Forest ranger",
    variant: "slim" as const,
    textureUrl: `https://textures.minecraft.net/texture/${"a".repeat(64)}`,
  },
  {
    id: "desert-ranger",
    name: "Desert ranger",
    variant: "classic" as const,
    textureUrl: `https://textures.minecraft.net/texture/${"b".repeat(64)}`,
  },
];
const noop = () => {};
const render = (
  state: GalleryState,
  query = "",
  locale: "en" | "ru" = "en",
  selectedId?: string,
) =>
  renderToStaticMarkup(
    <LocaleProvider locale={locale}>
      <StudioGallery
        state={state}
        query={query}
        onQuery={noop}
        onRetry={noop}
        onSelect={noop}
        selectedId={selectedId}
        layout="rail"
      />
    </LocaleProvider>,
  );

test("gallery names and models have accessible labels without selecting an entry", () => {
  const html = render({ status: "ready", skins });
  assert.match(html, /aria-label="Forest ranger, Slim model"/);
  assert.doesNotMatch(html, /aria-current="true"/);
  assert.doesNotMatch(html, /No skins found/);
  assert.doesNotMatch(html, /Clear search/);
});

test("gallery search and failure states give concise localized feedback", () => {
  assert.match(
    render({ status: "ready", skins }, "absent"),
    /No skins found\.<\/output><button[^>]*>Clear search</,
  );
  const error = render({ status: "error" }, "", "ru");
  assert.match(error, /Не удалось загрузить галерею/);
  assert.match(error, /Поиск в галерее/);
  assert.doesNotMatch(error, /The gallery could not be loaded/);
});

test("the grid is one Tab stop that starts on the selected skin", () => {
  const first = render({ status: "ready", skins });
  assert.equal(first.match(/tabindex="0"/g)?.length, 1);
  assert.match(first, /data-skin-id="forest-ranger" tabindex="0"/);
  const selected = render(
    { status: "ready", skins },
    "",
    "en",
    "desert-ranger",
  );
  assert.equal(selected.match(/tabindex="0"/g)?.length, 1);
  assert.match(selected, /data-skin-id="desert-ranger" tabindex="0"/);
});

test("arrow keys move by item and by row, and stop at the edges", () => {
  assert.equal(galleryKeyTarget("ArrowRight", 0, 5, 2), 1);
  assert.equal(galleryKeyTarget("ArrowDown", 1, 5, 2), 3);
  assert.equal(galleryKeyTarget("ArrowUp", 3, 5, 2), 1);
  assert.equal(galleryKeyTarget("ArrowDown", 3, 5, 2), undefined);
  assert.equal(galleryKeyTarget("ArrowLeft", 0, 5, 2), undefined);
  assert.equal(galleryKeyTarget("Home", 4, 5, 2), 0);
  assert.equal(galleryKeyTarget("End", 0, 5, 2), 4);
  assert.equal(galleryKeyTarget("Enter", 0, 5, 2), undefined);
});
