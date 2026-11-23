import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/lib/locale-provider";
import type { FillScope, PaintTool } from "@/lib/skin-paint";
import { ToolOptions } from "./tool-options";

const noop = () => {};

function render(
  tool: PaintTool,
  locale: "en" | "ru" = "en",
  fillScope: FillScope = "face",
) {
  return renderToStaticMarkup(
    <LocaleProvider locale={locale}>
      <ToolOptions
        tool={tool}
        size={3}
        mirror
        shade="darken"
        shadeStrength="medium"
        fillScope={fillScope}
        onSize={noop}
        onMirror={noop}
        onShade={noop}
        onShadeStrength={noop}
        onFillScope={noop}
      />
    </LocaleProvider>,
  );
}

test("only the active tool's options show", () => {
  assert.equal(render("eyedropper"), "");
  const fill = render("fill");
  assert.match(fill, /aria-label="Mirror"/u);
  assert.match(fill, /aria-pressed="true"/u);
  assert.doesNotMatch(fill, /Size|Lighten|Strong/u);
  assert.match(fill, />Face</u);
  assert.match(fill, />Everywhere</u);
  // Everywhere replaces one exact color, so Mirror has no effect and hides.
  const everywhere = render("fill", "en", "everywhere");
  assert.doesNotMatch(everywhere, /aria-label="Mirror"/u);
  assert.match(everywhere, /aria-label="Fill area"/u);
  const pencil = render("pencil");
  assert.match(pencil, />Size</u);
  assert.match(pencil, />3 px</u);
  assert.doesNotMatch(pencil, /Lighten|Strong|Everywhere/u);
  const shade = render("shade");
  assert.match(shade, /Lighten/u);
  assert.match(shade, /Darken/u);
  assert.match(shade, />Size</u);
  assert.match(shade, /aria-label="Shade strength"/u);
  for (const label of ["Soft", "Medium", "Strong"])
    assert.match(shade, new RegExp(`>${label}<`, "u"));
  assert.doesNotMatch(shade, /Everywhere/u);
});

test("tool options are translated", () => {
  const html = render("shade", "ru");
  assert.match(html, /aria-label="Зеркальное рисование"/u);
  assert.match(html, />Размер</u);
  assert.match(html, /3 пикс\./u);
  assert.match(html, /Темнее/u);
});

test("shade directions show their shortcut hint", () => {
  const html = render("shade");
  for (const label of ["Lighten", "Darken"]) {
    const item = new RegExp(
      `<button([^>]*)>(?:(?!</button>).)*${label}</button>`,
      "u",
    ).exec(html)?.[1];
    assert.ok(item, `${label} button`);
    assert.match(item, /data-base-ui-tooltip-trigger/u);
    assert.match(item, /aria-keyshortcuts="S"/u);
  }
});
