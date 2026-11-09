import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SaveStatus } from "@/components/save-status";
import { checkSkin } from "@/lib/skin-check";
import { createTemplate, pixelOffset } from "@/lib/skin-document";
import { SkinIssueAlerts } from "./skin-issue-alerts";

const noop = () => {};

function render(pixels: Uint8ClampedArray, variant: "classic" | "slim") {
  return renderToStaticMarkup(
    <SkinIssueAlerts
      issues={checkSkin(pixels, variant)}
      highlighted={null}
      onHighlight={noop}
      onRepair={noop}
      onVariant={noop}
    />,
  );
}

test("a skin without problems renders no alert, heading, or wrapper", () => {
  assert.equal(render(createTemplate("classic").pixels, "classic"), "");
});

test("a skin with a problem shows its alert and fix", () => {
  const { pixels } = createTemplate("classic");
  pixels.set([60, 70, 80, 100], pixelOffset(10, 10));
  const html = render(pixels, "classic");
  assert.ok(html.includes("See-through base pixels"));
  assert.ok(html.includes("Make opaque"));
  assert.ok(html.includes("Show pixels"));
  assert.ok(!html.includes("No problems"));
});

test("the save status has an accessible name and a matching title", () => {
  const html = renderToStaticMarkup(
    <SaveStatus state="unsaved" label="Unsaved changes" />,
  );
  assert.ok(html.includes('role="img"'));
  assert.ok(html.includes('aria-label="Unsaved changes"'));
  assert.ok(html.includes('title="Unsaved changes"'));
});
