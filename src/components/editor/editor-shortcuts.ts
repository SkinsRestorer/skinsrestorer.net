"use client";

import { useState } from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import {
  detectPlatform,
  type HotkeyChord,
  type HotkeyPlatform,
} from "@tanstack/react-hotkeys";
import type { PaintTool } from "@/lib/skin-paint";

/**
 * Keyboard shortcuts of the editor. The keyboard handler, the toolbar
 * hints, and `aria-keyshortcuts` all read this table.
 */
export const editorShortcuts = {
  pencil: ["B"],
  eraser: ["E"],
  shade: ["S"],
  fill: ["G"],
  eyedropper: ["I"],
  mirror: ["X"],
  smaller: ["["],
  larger: ["]"],
  layer: ["L"],
  paint: ["P"],
  move: ["M"],
  // "=" is the unshifted "+" key on US layouts.
  zoomIn: ["+", "="],
  zoomOut: ["-"],
  fit: ["0"],
  undo: ["Mod+Z"],
  redo: ["Mod+Shift+Z", "Mod+Y"],
  close: ["Escape"],
} as const satisfies Record<string, readonly HotkeyChord[]>;

export type EditorCommand = keyof typeof editorShortcuts;

export const toolCommands: readonly PaintTool[] = [
  "pencil",
  "eraser",
  "shade",
  "fill",
  "eyedropper",
];

/**
 * The `aria-keyshortcuts` value: ARIA key names joined by spaces, such as
 * "Control+Z Control+Y". It never uses display symbols such as ⌘.
 */
export function ariaShortcuts(
  commands: readonly EditorCommand[],
  platform: HotkeyPlatform,
) {
  return commands
    .flatMap((command) => editorShortcuts[command])
    .map((hotkey) =>
      // ARIA separates keys with "+", so the plus key is named "Plus".
      hotkey === "+"
        ? "Plus"
        : hotkey.replace("Mod+", platform === "mac" ? "Meta+" : "Control+"),
    )
    .join(" ");
}

/** `aria-keyshortcuts` for these commands on this device. */
export function useAriaShortcuts(...commands: readonly EditorCommand[]) {
  // The editor renders only in the browser, after the user opens it.
  // oxlint-disable-next-line react/hook-use-state -- This value uses lazy initialization and has no setter.
  const [platform] = useState(() => detectPlatform());
  return ariaShortcuts(commands, platform);
}

export interface ShortcutHintPayload {
  label: string;
  commands: readonly EditorCommand[];
}

export type ShortcutHintHandle = TooltipPrimitive.Handle<ShortcutHintPayload>;

/**
 * How long the pointer rests on a control before its hint opens. A quick
 * click never opens a hint, so it skips the popup mount and positioning.
 * After one hint opens, the tooltip provider opens the next one at once.
 * Keyboard focus opens a hint without a delay.
 */
export const HINT_DELAY = 400;

/** A handle that connects many hint triggers to one shared tooltip. */
export function useShortcutHints(): ShortcutHintHandle {
  // oxlint-disable-next-line react/hook-use-state -- This value uses lazy initialization and has no setter.
  const [handle] = useState(() =>
    TooltipPrimitive.createHandle<ShortcutHintPayload>(),
  );
  return handle;
}
