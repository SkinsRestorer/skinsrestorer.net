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
