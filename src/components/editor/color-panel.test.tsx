import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ColorControls } from "./color-panel";

test("the opacity slider reads its value as a percentage", () => {
  const html = renderToStaticMarkup(
    <ColorControls
      color={[255, 0, 0, 128]}
      layer="outer"
      recent={[]}
      onChange={() => {}}
    />,
  );
  assert.ok(html.includes('aria-valuetext="50%"'));
});

test("the recent swatch of the current color is marked as pressed", () => {
  const html = renderToStaticMarkup(
    <ColorControls
      color={[255, 0, 0, 128]}
      layer="outer"
      recent={[
        [255, 0, 0, 255],
        [255, 0, 0, 128],
      ]}
      onChange={() => {}}
    />,
  );
  // Same RGB at another opacity is a different color.
  assert.match(
    html,
    /aria-label="Use #ff0000 at 100% opacity" aria-pressed="false"/u,
  );
  assert.match(
    html,
    /aria-label="Use #ff0000 at 50% opacity" aria-pressed="true"/u,
  );
  assert.match(html, /maxLength="7"/u);
});
