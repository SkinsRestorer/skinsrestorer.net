import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/lib/i18n-react";
import type { PaintTool } from "@/lib/skin-paint";
import { ToolOptions } from "./tool-options";

const noop = () => {};

function render(tool: PaintTool, locale: "en" | "ru" = "en") {
  return renderToStaticMarkup(
    <LocaleProvider locale={locale}>
      <ToolOptions
        tool={tool}
        size={3}
        mirror
        shade="darken"
        onSize={noop}
        onMirror={noop}
        onShade={noop}
      />
    </LocaleProvider>,
  );
}

test("only the active tool's options show", () => {
  assert.equal(render("eyedropper"), "");
  const fill = render("fill");
  assert.match(fill, /aria-label="Mirror"/);
  assert.match(fill, /aria-pressed="true"/);
  assert.doesNotMatch(fill, /Size|Lighten/);
  const pencil = render("pencil");
  assert.match(pencil, />Size</);
  assert.match(pencil, />3 px</);
  assert.doesNotMatch(pencil, /Lighten/);
  const shade = render("shade");
  assert.match(shade, /Lighten/);
  assert.match(shade, /Darken/);
  assert.match(shade, />Size</);
});

test("tool options are translated", () => {
  const html = render("shade", "ru");
  assert.match(html, /aria-label="Зеркальное рисование"/);
  assert.match(html, />Размер</);
  assert.match(html, /3 пикс\./);
  assert.match(html, /Темнее/);
});
