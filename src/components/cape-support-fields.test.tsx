import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { CapeStatus } from "@/lib/studio-options";
import { MineSkinKeyField } from "./cape-support-fields";

const noop = () => {};

function render(status: CapeStatus) {
  const html = renderToStaticMarkup(
    <MineSkinKeyField
      value="key"
      status={status}
      onChange={noop}
      onBlur={noop}
      onCheckCapeAccess={noop}
    />,
  );
  const input = /<input[^>]*>/.exec(html)?.[0] ?? "";
  const describedBy = /aria-describedby="([^"]+)"/.exec(input)?.[1];
  return { html, input, describedBy };
}

test("a key without the capes grant marks the field invalid and names the error", () => {
  const { html, input, describedBy } = render("denied");
  assert.ok(input.includes('aria-invalid="true"'));
  assert.ok(describedBy);
  const error = new RegExp(`<div[^>]*id="${describedBy}"[^>]*>([^<]*)<`).exec(
    html,
  );
  assert.ok(error?.[0].includes('role="alert"'));
  assert.equal(
    error?.[1],
    "Cape support requires an API key with the capes grant.",
  );
});

test("a granted key keeps a visible confirmation tied to the field", () => {
  const { html, input, describedBy } = render("granted");
  assert.ok(!input.includes(`aria-invalid="`));
  assert.ok(describedBy);
  assert.match(
    html,
    new RegExp(
      `id="${describedBy}"[^>]*>Cape support enabled for this API key.<`,
    ),
  );
});

test("an unchecked key has no status message", () => {
  const { input, describedBy } = render("idle");
  assert.ok(!input.includes(`aria-invalid="`));
  assert.equal(describedBy, undefined);
});
