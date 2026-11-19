import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/lib/locale-provider";
import { EditorToolbar } from "./editor-toolbar";

const noop = () => {};

function render(canUndo: boolean, canRedo: boolean) {
  return renderToStaticMarkup(
    <LocaleProvider locale="en">
      <EditorToolbar
        tool="pencil"
        layer="base"
        interaction="paint"
        canUndo={canUndo}
        canRedo={canRedo}
        onTool={noop}
        onInteraction={noop}
        onUndo={noop}
        onRedo={noop}
      />
    </LocaleProvider>,
  );
}

function button(html: string, label: string) {
  const match = new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`, "u").exec(
    html,
  );
  assert.ok(match, `${label} button`);
  return match[0];
}

test("undo and redo stay hoverable and focusable without history", () => {
  const html = render(false, true);
  const undo = button(html, "Undo");
  // A native disabled button gets no pointer events, so its hint never opens.
  assert.doesNotMatch(undo, /\sdisabled=""/u);
  assert.match(undo, /aria-disabled="true"/u);
  assert.match(undo, /data-base-ui-tooltip-trigger/u);
  assert.doesNotMatch(button(html, "Redo"), /aria-disabled="true"/u);
});

test("every toolbar control is a hint trigger without a mounted popup", () => {
  const html = render(true, true);
  for (const label of ["Pencil", "Eraser", "Paint", "Move view", "Undo"])
    assert.match(button(html, label), /data-base-ui-tooltip-trigger/u);
  assert.doesNotMatch(html, /data-slot="tooltip-content"/u);
});
