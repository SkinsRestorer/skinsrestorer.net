"use client";

import { useState } from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import {
  detectPlatform,
  useFormatForDisplay,
  type HotkeyChord,
  type HotkeyPlatform,
} from "@tanstack/react-hotkeys";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { TooltipContent } from "@/components/ui/tooltip";
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
      hotkey.replace("Mod+", platform === "mac" ? "Meta+" : "Control+"),
    )
    .join(" ");
}

/** `aria-keyshortcuts` for these commands on this device. */
export function useAriaShortcuts(...commands: readonly EditorCommand[]) {
  // The editor renders only in the browser, after the user opens it.
  const [platform] = useState(() => detectPlatform());
  return ariaShortcuts(commands, platform);
}

/** A quiet key hint for tooltips, such as "B" or "Ctrl+Z". */
export function ShortcutKeys(props: { commands: readonly EditorCommand[] }) {
  const format = useFormatForDisplay();
  return (
    <KbdGroup aria-hidden="true">
      {props.commands
        .flatMap((command) => editorShortcuts[command])
        .map((hotkey) => (
          <Kbd key={hotkey}>{format(hotkey)}</Kbd>
        ))}
    </KbdGroup>
  );
}

/** Tooltip text with its key hint. */
export function ShortcutHint(props: {
  label: string;
  commands: readonly EditorCommand[];
}) {
  return (
    <span className="flex items-center gap-2">
      {props.label}
      <ShortcutKeys commands={props.commands} />
    </span>
  );
}

export type ShortcutHintPayload = {
  label: string;
  commands: readonly EditorCommand[];
};

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
  const [handle] = useState(() =>
    TooltipPrimitive.createHandle<ShortcutHintPayload>(),
  );
  return handle;
}

/**
 * One tooltip for a group of controls. Each control is a `HintTrigger`
 * that sends its own text, so only the hovered control renders hint content.
 */
export function ShortcutHints(props: { handle: ShortcutHintHandle }) {
  return (
    <TooltipPrimitive.Root data-slot="tooltip" handle={props.handle}>
      {({ payload }) =>
        payload && (
          <TooltipContent>
            <ShortcutHint label={payload.label} commands={payload.commands} />
          </TooltipContent>
        )
      }
    </TooltipPrimitive.Root>
  );
}

/** A control that shows its label and keys in the shared hint tooltip. */
export function HintTrigger({
  hints,
  label,
  commands,
  ...props
}: Omit<
  TooltipPrimitive.Trigger.Props<ShortcutHintPayload>,
  "handle" | "payload" | "delay"
> & {
  hints: ShortcutHintHandle;
  label: string;
  commands: readonly EditorCommand[];
}) {
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      handle={hints}
      payload={{ label, commands }}
      delay={HINT_DELAY}
      {...props}
    />
  );
}
