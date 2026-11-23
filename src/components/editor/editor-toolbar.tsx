"use client";

import {
  Brush,
  Contrast,
  Eraser,
  Hand,
  MousePointer2,
  PaintBucket,
  Pipette,
  Redo2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { PaintTool } from "@/lib/skin-paint";
import type { SkinLayer } from "@/lib/skin-regions";
import {
  toolLabels,
  type EditorInteraction,
} from "@/components/editor/editor-types";
import {
  HintTrigger,
  ShortcutHints,
} from "@/components/editor/editor-commands";
import {
  editorShortcuts,
  toolCommands,
  useAriaShortcuts,
  useShortcutHints,
} from "@/components/editor/editor-shortcuts";
import { useT } from "@/lib/i18n-react";
import { findOption } from "@/lib/utils";

const toolIcons = {
  pencil: Brush,
  eraser: Eraser,
  shade: Contrast,
  fill: PaintBucket,
  eyedropper: Pipette,
} as const;

/** Larger hit areas when the main pointer is a finger. */
const coarse = "pointer-coarse:h-9 pointer-coarse:min-w-9";

/**
 * Icon-only paint tools, pointer action, and undo/redo. Undo and Redo stay
 * focusable and hoverable when there is nothing to do, so their hint still
 * explains the shortcut. Base UI then sets `aria-disabled` instead of
 * `disabled`.
 */
export function EditorToolbar(props: {
  tool: PaintTool;
  layer: SkinLayer;
  interaction: EditorInteraction;
  canUndo: boolean;
  canRedo: boolean;
  onTool: (tool: PaintTool) => void;
  onInteraction: (interaction: EditorInteraction) => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const t = useT();
  const undoKeys = useAriaShortcuts("undo");
  const redoKeys = useAriaShortcuts("redo");
  const hints = useShortcutHints();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ShortcutHints handle={hints} />
      <ToggleGroup
        aria-label={t("editor.tool")}
        variant="outline"
        size="sm"
        spacing={0}
        value={[props.tool]}
        onValueChange={(value) => {
          const tool = findOption(toolCommands, value[0]);
          if (tool) props.onTool(tool);
        }}
      >
        {toolCommands.map((tool) => {
          const Icon = toolIcons[tool];
          const label = t(toolLabels[tool]);
          const hint =
            tool === "eraser" && props.layer === "base"
              ? t("editor.toolWorksOuterLayerOnlyBaseLayer", { tool: label })
              : tool === "eyedropper"
                ? t("editor.altClickPicksAnyTool", { tool: label })
                : label;
          return (
            <HintTrigger
              key={tool}
              hints={hints}
              label={hint}
              commands={[tool]}
              render={
                <ToggleGroupItem
                  value={tool}
                  className={coarse}
                  aria-label={label}
                  aria-keyshortcuts={editorShortcuts[tool].join(" ")}
                />
              }
            >
              <Icon />
            </HintTrigger>
          );
        })}
      </ToggleGroup>
      <Separator orientation="vertical" className="hidden h-5 sm:block" />
      <ToggleGroup
        aria-label={t("editor.pointerAction")}
        variant="outline"
        size="sm"
        spacing={0}
        value={[props.interaction]}
        onValueChange={(value) => {
          const interaction = findOption(["paint", "move"], value[0]);
          if (interaction) props.onInteraction(interaction);
        }}
      >
        <HintTrigger
          hints={hints}
          label={t("editor.pointersUseTool")}
          commands={["paint"]}
          render={
            <ToggleGroupItem
              value="paint"
              className={coarse}
              aria-label={t("editor.paint")}
              aria-keyshortcuts={editorShortcuts.paint.join(" ")}
            />
          }
        >
          <MousePointer2 />
        </HintTrigger>
        <HintTrigger
          hints={hints}
          label={t("editor.pointersScrollTextureTurnModel")}
          commands={["move"]}
          render={
            <ToggleGroupItem
              value="move"
              className={coarse}
              aria-label={t("editor.moveView")}
              aria-keyshortcuts={editorShortcuts.move.join(" ")}
            />
          }
        >
          <Hand />
        </HintTrigger>
      </ToggleGroup>
      <Separator orientation="vertical" className="hidden h-5 sm:block" />
      <div className="flex gap-1">
        <HintTrigger
          hints={hints}
          label={props.canUndo ? t("common.undo") : t("editor.nothingToUndo")}
          commands={["undo"]}
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className={coarse}
              aria-label={t("common.undo")}
              aria-keyshortcuts={undoKeys}
              disabled={!props.canUndo}
              focusableWhenDisabled
              onClick={props.onUndo}
            />
          }
        >
          <Undo2 />
        </HintTrigger>
        <HintTrigger
          hints={hints}
          label={props.canRedo ? t("common.redo") : t("editor.nothingToRedo")}
          commands={["redo"]}
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className={coarse}
              aria-label={t("common.redo")}
              aria-keyshortcuts={redoKeys}
              disabled={!props.canRedo}
              focusableWhenDisabled
              onClick={props.onRedo}
            />
          }
        >
          <Redo2 />
        </HintTrigger>
      </div>
    </div>
  );
}
