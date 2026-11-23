import assert from "node:assert/strict";
import { test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EnderDashSponsor } from "./enderdash-sponsor";

test("the sponsor link opens in the same tab and names its placement", () => {
  const html = renderToStaticMarkup(
    <EnderDashSponsor placement="docs-footer" />,
  );
  const link = /<a\b[^>]*>/u.exec(html)?.[0];

  assert.ok(link);
  assert.doesNotMatch(link, /target=/u);
  assert.match(link, /rel="sponsored"/u);
  assert.match(link, /utm_medium=docs-footer/u);
  assert.match(html, /EnderDash/u);
});
