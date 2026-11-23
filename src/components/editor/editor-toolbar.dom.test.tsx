import assert from "node:assert/strict";
import { test } from "node:test";
import { LocaleProvider } from "@/lib/locale-provider";
import { render, registerDom } from "@/test/dom";
import { EditorToolbar } from "./editor-toolbar";

registerDom();

const noop = () => {};

function renderToolbar() {
  return render(
    <LocaleProvider locale="en">
      <EditorToolbar
        tool="pencil"
        layer="outer"
        interaction="paint"
        canUndo
        canRedo={false}
        onTool={noop}
        onInteraction={noop}
        onUndo={noop}
        onRedo={noop}
      />
    </LocaleProvider>,
  );
}

function control(container: HTMLElement, label: string) {
  const match = container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  assert.ok(match, `No "${label}" control`);
  return match;
}

test("each control names its shortcut keys for assistive technology", () => {
  const view = renderToolbar();
  try {
    const keys = (label: string) =>
      control(view.container, label).getAttribute("aria-keyshortcuts");
    assert.equal(keys("Pencil"), "B");
    assert.equal(keys("Eraser"), "E");
    assert.equal(keys("Shade"), "S");
    assert.equal(keys("Fill"), "G");
    assert.equal(keys("Pick color"), "I");
    assert.equal(keys("Paint"), "P");
    assert.equal(keys("Move view"), "M");
    // The test DOM is not a Mac, so Mod means Control.
    assert.equal(keys("Undo"), "Control+Z");
    assert.equal(keys("Redo"), "Control+Shift+Z Control+Y");
  } finally {
    view.unmount();
  }
});
