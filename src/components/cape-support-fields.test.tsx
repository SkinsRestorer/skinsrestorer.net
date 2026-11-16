import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { CapeStatus } from "@/lib/studio-options";
import { CapePicker, MineSkinKeyField } from "./cape-support-fields";
import { NO_CAPE_VALUE } from "@/lib/studio-options";

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

function renderPicker(listStatus: "loading" | "ready" | "failed") {
  return renderToStaticMarkup(
    <CapePicker
      capeOptionsDisabled
      supportedCapes={[]}
      listStatus={listStatus}
      onRetryList={noop}
      selectedCapeUuid={NO_CAPE_VALUE}
      onCapeChange={noop}
    />,
  );
}

test("a loading cape list says so instead of looking empty", () => {
  const html = renderPicker("loading");
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /<output[^>]*>Loading capes…<\/output>/);
  assert.ok(html.includes('aria-label="No cape"'));
});

test("a failed cape list explains it and offers a retry", () => {
  const html = renderPicker("failed");
  assert.ok(html.includes("Failed to load available capes"));
  assert.match(html, /<button[^>]*>Try again<\/button>/);
  assert.ok(!html.includes("Loading capes"));
});

test("a loaded empty cape list shows no loading or error state", () => {
  const html = renderPicker("ready");
  assert.ok(!html.includes("aria-busy"));
  assert.ok(!html.includes("Loading capes"));
  assert.ok(!html.includes("Try again"));
});
