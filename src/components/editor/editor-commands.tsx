"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { useFormatForDisplay } from "@tanstack/react-hotkeys";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { TooltipContent } from "@/components/ui/tooltip";
import {
  editorShortcuts,
  HINT_DELAY,
  type EditorCommand,
  type ShortcutHintHandle,
  type ShortcutHintPayload,
} from "@/components/editor/editor-shortcuts";

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
