import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Feedback } from "./feedback";

test("the rating buttons form a group named by the question and expose their state", () => {
  const html = renderToStaticMarkup(
    <Feedback url="/docs/installation" version="15.12.6" />,
  );
  const group = /<div[^>]*role="group"[^>]*>/.exec(html)?.[0] ?? "";
  const labelledBy = /aria-labelledby="([^"]+)"/.exec(group)?.[1];
  assert.ok(labelledBy);
  const question = new RegExp(`<p[^>]*id="${labelledBy}"[^>]*>([^<]*)<`).exec(
    html,
  );
  assert.equal(question?.[1], "Did this page help?");

  const buttons = html.match(/<button[^>]*>/g) ?? [];
  assert.equal(buttons.length, 2);
  for (const button of buttons) {
    assert.ok(button.includes('aria-pressed="false"'));
  }
});
