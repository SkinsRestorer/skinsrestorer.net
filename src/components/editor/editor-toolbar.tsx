"use client";

import {
  Brush,
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

const toolIcons = {
  pencil: Brush,
  eraser: Eraser,
  fill: PaintBucket,
  eyedropper: Pipette,
} as const;

const tools: readonly PaintTool[] = ["pencil", "eraser", "fill", "eyedropper"];

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
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        aria-label="Tool"
        variant="outline"
        spacing={0}
        value={[props.tool]}
        onValueChange={(value) => {
          if (value[0]) props.onTool(value[0] as PaintTool);
        }}
      >
        {tools.map((tool) => {
          const Icon = toolIcons[tool];
          const { label, key } = toolLabels[tool];
          const hint =
            tool === "eraser" && props.layer === "base"
              ? `${label} (${key}) works on the outer layer only. The base layer is always opaque.`
              : `${label} (${key})`;
          return (
            <Tooltip key={tool}>
              <TooltipTrigger
                render={
                  <ToggleGroupItem
                    value={tool}
                    aria-label={label}
                    aria-keyshortcuts={key}
                  />
                }
              >
                <Icon />
                <span className="hidden sm:inline">{label}</span>
              </TooltipTrigger>
              <TooltipContent>{hint}</TooltipContent>
            </Tooltip>
          );
        })}
      </ToggleGroup>
      <Separator orientation="vertical" className="hidden h-6 sm:block" />
      <ToggleGroup
        aria-label="Pointer action"
        variant="outline"
        spacing={0}
        value={[props.interaction]}
        onValueChange={(value) => {
          if (value[0]) props.onInteraction(value[0] as EditorInteraction);
        }}
      >
        <Tooltip>
          <TooltipTrigger
            render={<ToggleGroupItem value="paint" aria-keyshortcuts="P" />}
          >
            <Brush />
            Paint
          </TooltipTrigger>
          <TooltipContent>Pointers use the tool (P)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={<ToggleGroupItem value="move" aria-keyshortcuts="M" />}
          >
            <Hand />
            Move view
          </TooltipTrigger>
          <TooltipContent>
            Pointers scroll the texture and turn the model (M)
          </TooltipContent>
        </Tooltip>
      </ToggleGroup>
      <Separator orientation="vertical" className="hidden h-6 sm:block" />
      <div className="flex gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Undo"
                aria-keyshortcuts="Control+Z"
                disabled={!props.canUndo}
                onClick={props.onUndo}
              />
            }
          >
            <Undo2 />
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Redo"
                aria-keyshortcuts="Control+Shift+Z Control+Y"
                disabled={!props.canRedo}
                onClick={props.onRedo}
              />
            }
          >
            <Redo2 />
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Shift+Z or Ctrl+Y)</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
