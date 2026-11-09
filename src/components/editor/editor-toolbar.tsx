"use client";

import {
  Brush,
  Contrast,
  Eraser,
  Hand,
  PaintBucket,
  Pipette,
  Redo2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PaintTool } from "@/lib/skin-paint";
import type { SkinLayer } from "@/lib/skin-regions";
import {
  toolLabels,
  type EditorInteraction,
} from "@/components/editor/editor-types";
import {
  editorShortcuts,
  ShortcutHint,
  toolCommands,
  useAriaShortcuts,
} from "@/components/editor/editor-commands";
import { useT } from "@/lib/i18n-react";

const toolIcons = {
  pencil: Brush,
  eraser: Eraser,
  shade: Contrast,
  fill: PaintBucket,
  eyedropper: Pipette,
} as const;

/** Larger hit areas when the main pointer is a finger. */
const coarse = "pointer-coarse:h-9 pointer-coarse:min-w-9";

/** Icon-only paint tools, pointer action, and undo/redo. */
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
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ToggleGroup
        aria-label={t("Tool")}
        variant="outline"
        size="sm"
        spacing={0}
        value={[props.tool]}
        onValueChange={(value) => {
          if (value[0]) props.onTool(value[0] as PaintTool);
        }}
      >
        {toolCommands.map((tool) => {
          const Icon = toolIcons[tool];
          const label = t(toolLabels[tool]);
          const hint =
            tool === "eraser" && props.layer === "base"
              ? t(
                  "{tool} works on the outer layer only. The base layer is always opaque.",
                  { tool: label },
                )
              : label;
          return (
            <Tooltip key={tool}>
              <TooltipTrigger
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
              </TooltipTrigger>
              <TooltipContent>
                <ShortcutHint label={hint} commands={[tool]} />
              </TooltipContent>
            </Tooltip>
          );
        })}
      </ToggleGroup>
      <Separator orientation="vertical" className="hidden h-5 sm:block" />
      <ToggleGroup
        aria-label={t("Pointer action")}
        variant="outline"
        size="sm"
        spacing={0}
        value={[props.interaction]}
        onValueChange={(value) => {
          if (value[0]) props.onInteraction(value[0] as EditorInteraction);
        }}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <ToggleGroupItem
                value="paint"
                className={coarse}
                aria-label={t("Paint")}
                aria-keyshortcuts={editorShortcuts.paint.join(" ")}
              />
            }
          >
            <Brush />
          </TooltipTrigger>
          <TooltipContent>
            <ShortcutHint
              label={t("Pointers use the tool")}
              commands={["paint"]}
            />
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <ToggleGroupItem
                value="move"
                className={coarse}
                aria-label={t("Move view")}
                aria-keyshortcuts={editorShortcuts.move.join(" ")}
              />
            }
          >
            <Hand />
          </TooltipTrigger>
          <TooltipContent>
            <ShortcutHint
              label={t("Pointers scroll the texture and turn the model")}
              commands={["move"]}
            />
          </TooltipContent>
        </Tooltip>
      </ToggleGroup>
      <Separator orientation="vertical" className="hidden h-5 sm:block" />
      <div className="flex gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("Undo")}
                aria-keyshortcuts={undoKeys}
                disabled={!props.canUndo}
                onClick={props.onUndo}
              />
            }
          >
            <Undo2 />
          </TooltipTrigger>
          <TooltipContent>
            <ShortcutHint label={t("Undo")} commands={["undo"]} />
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("Redo")}
                aria-keyshortcuts={redoKeys}
                disabled={!props.canRedo}
                onClick={props.onRedo}
              />
            }
          >
            <Redo2 />
          </TooltipTrigger>
          <TooltipContent>
            <ShortcutHint label={t("Redo")} commands={["redo"]} />
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
