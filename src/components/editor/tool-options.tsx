"use client";

import { FlipHorizontal2, Moon, Sun } from "lucide-react";
import { useId } from "react";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usesBrush } from "@/components/editor/editor-types";
import { BRUSH_SIZES, type PaintTool, type ShadeMode } from "@/lib/skin-paint";
import { useT } from "@/lib/i18n-react";

/**
 * Settings of the active tool only: mirror for tools that change pixels,
 * brush size for brush tools, and the shade direction for Shade.
 */
export function ToolOptions(props: {
  tool: PaintTool;
  size: number;
  mirror: boolean;
  shade: ShadeMode;
  onSize: (size: number) => void;
  onMirror: (mirror: boolean) => void;
  onShade: (shade: ShadeMode) => void;
}) {
  const t = useT();
  const sizeId = useId();
  if (props.tool === "eyedropper") return null;
  return (
    <fieldset className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
      <legend className="sr-only">{t("Tool options")}</legend>
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              variant="outline"
              size="sm"
              aria-label={t("Mirror")}
              aria-keyshortcuts="X"
              className="pointer-coarse:h-9 pointer-coarse:min-w-9"
              pressed={props.mirror}
              onPressedChange={props.onMirror}
            />
          }
        >
          <FlipHorizontal2 />
        </TooltipTrigger>
        <TooltipContent>{t("Mirror left and right (X)")}</TooltipContent>
      </Tooltip>
      {usesBrush(props.tool) && (
        <div className="flex items-center gap-2">
          <span id={sizeId} className="text-xs text-muted-foreground">
            {t("Size")}
          </span>
          <div className="w-24">
            <Slider
              aria-labelledby={sizeId}
              aria-keyshortcuts="[ ]"
              min={BRUSH_SIZES.min}
              max={BRUSH_SIZES.max}
              step={1}
              value={[props.size]}
              onValueChange={(value) =>
                props.onSize(Array.isArray(value) ? value[0] : value)
              }
            />
          </div>
          <span className="min-w-8 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
            {t("{size} px", { size: props.size })}
          </span>
        </div>
      )}
      {props.tool === "shade" && (
        <ToggleGroup
          aria-label={t("Shade")}
          variant="outline"
          size="sm"
          spacing={0}
          value={[props.shade]}
          onValueChange={(value) => {
            if (value[0]) props.onShade(value[0] as ShadeMode);
          }}
        >
          <ToggleGroupItem
            value="lighten"
            className="pointer-coarse:h-9"
            aria-keyshortcuts="S"
          >
            <Sun />
            {t("Lighten")}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="darken"
            className="pointer-coarse:h-9"
            aria-keyshortcuts="S"
          >
            <Moon />
            {t("Darken")}
          </ToggleGroupItem>
        </ToggleGroup>
      )}
    </fieldset>
  );
}
