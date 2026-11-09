import assert from "node:assert/strict";
import { test } from "node:test";
import { ariaShortcuts, editorShortcuts } from "./editor-commands";

test("aria-keyshortcuts use ARIA key names for each platform", () => {
  assert.equal(ariaShortcuts(["undo"], "windows"), "Control+Z");
  assert.equal(ariaShortcuts(["undo"], "mac"), "Meta+Z");
  assert.equal(ariaShortcuts(["redo"], "linux"), "Control+Shift+Z Control+Y");
  assert.equal(ariaShortcuts(["smaller", "larger"], "mac"), "[ ]");
  assert.doesNotMatch(ariaShortcuts(["undo", "redo"], "mac"), /[⌘⇧]/);
});

test("every editor key is bound to one command only", () => {
  const keys = Object.values(editorShortcuts).flat();
  assert.equal(new Set(keys).size, keys.length);
});
