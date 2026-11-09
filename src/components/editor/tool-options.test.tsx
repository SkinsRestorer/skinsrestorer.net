import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/lib/i18n-react";
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
  assert.match(fill, /aria-label="Mirror"/);
  assert.match(fill, /aria-pressed="true"/);
  assert.doesNotMatch(fill, /Size|Lighten|Strong/);
  assert.match(fill, />Face</);
  assert.match(fill, />Everywhere</);
  // Everywhere replaces one exact color, so Mirror has no effect and hides.
  const everywhere = render("fill", "en", "everywhere");
  assert.doesNotMatch(everywhere, /aria-label="Mirror"/);
  assert.match(everywhere, /aria-label="Fill area"/);
  const pencil = render("pencil");
  assert.match(pencil, />Size</);
  assert.match(pencil, />3 px</);
  assert.doesNotMatch(pencil, /Lighten|Strong|Everywhere/);
  const shade = render("shade");
  assert.match(shade, /Lighten/);
  assert.match(shade, /Darken/);
  assert.match(shade, />Size</);
  assert.match(shade, /aria-label="Shade strength"/);
  for (const label of ["Soft", "Medium", "Strong"])
    assert.match(shade, new RegExp(`>${label}<`));
  assert.doesNotMatch(shade, /Everywhere/);
});

test("tool options are translated", () => {
  const html = render("shade", "ru");
  assert.match(html, /aria-label="Зеркальное рисование"/);
  assert.match(html, />Размер</);
  assert.match(html, /3 пикс\./);
  assert.match(html, /Темнее/);
});
