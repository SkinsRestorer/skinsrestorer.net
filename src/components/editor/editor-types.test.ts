import assert from "node:assert/strict";
import { test } from "node:test";
import { createTemplate } from "@/lib/skin-document";
import { SkinEditorStore } from "@/lib/skin-editor-store";
import {
  allPartsVisible,
  defaultBrush,
  type PaintTool,
  type Rgba,
} from "@/lib/skin-paint";
import { startTool, type EditorSurfaceProps } from "./editor-types";

function surface(tool: PaintTool) {
  const store = new SkinEditorStore();
  store.load(createTemplate("classic"));
  const picked: Rgba[] = [];
  let painted = 0;
  const props: EditorSurfaceProps = {
    store,
    tool,
    settings: {
      layer: "base",
      color: [200, 10, 10, 255],
      visibility: allPartsVisible(),
      ...defaultBrush,
    },
    interaction: "paint",
    onPick: (color) => picked.push(color),
    onPainted: () => painted++,
    onStatus: () => {},
  };
  return { store, props, picked, painted: () => painted };
}

test("Alt picks the color with a paint tool and changes no pixels", () => {
  for (const tool of ["pencil", "fill", "shade"] as const) {
    const { store, props, picked, painted } = surface(tool);
    const before = store.pixels.slice();
    assert.equal(startTool(props, 8, 8, { pick: true }), "done");
    assert.deepEqual(picked, [store.colorAt(8, 8)]);
    assert.equal(painted(), 0);
    assert.deepEqual(store.pixels, before);
    assert.equal(store.getSnapshot().canUndo, false);
  }
});

test("without Alt the pencil starts a stroke", () => {
  const { props, picked } = surface("pencil");
  assert.equal(startTool(props, 8, 8), "stroke");
  assert.deepEqual(picked, []);
});
