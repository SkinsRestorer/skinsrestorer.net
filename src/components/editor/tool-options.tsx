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
import {
  editorShortcuts,
  ShortcutHint,
} from "@/components/editor/editor-commands";
import {
  BRUSH_SIZES,
  type FillScope,
  type PaintTool,
  type ShadeMode,
  type ShadeStrength,
} from "@/lib/skin-paint";
import { useT } from "@/lib/i18n-react";

const shadeStrengths: ReadonlyArray<{ value: ShadeStrength; label: string }> = [
  { value: "soft", label: "Soft" },
  { value: "medium", label: "Medium" },
  { value: "strong", label: "Strong" },
];

/**
 * Settings of the active tool only: mirror for tools that change pixels,
 * brush size for brush tools, the area for Fill, and the shade direction and
 * strength for Shade.
 */
export function ToolOptions(props: {
  tool: PaintTool;
  size: number;
  mirror: boolean;
  shade: ShadeMode;
  shadeStrength: ShadeStrength;
  fillScope: FillScope;
  onSize: (size: number) => void;
  onMirror: (mirror: boolean) => void;
  onShade: (shade: ShadeMode) => void;
  onShadeStrength: (strength: ShadeStrength) => void;
  onFillScope: (scope: FillScope) => void;
}) {
  const t = useT();
  const sizeId = useId();
  if (props.tool === "eyedropper") return null;
  // Everywhere replaces one exact color, so a mirror adds nothing to it.
  const showMirror = !(
    props.tool === "fill" && props.fillScope === "everywhere"
  );
  return (
    <fieldset className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
      <legend className="sr-only">{t("Tool options")}</legend>
      {props.tool === "fill" && (
        <ToggleGroup
          aria-label={t("Fill area")}
          variant="outline"
          size="sm"
          spacing={0}
          value={[props.fillScope]}
          onValueChange={(value) => {
            if (value[0]) props.onFillScope(value[0] as FillScope);
          }}
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  value="face"
                  className="pointer-coarse:h-9"
                  aria-keyshortcuts={editorShortcuts.fill.join(" ")}
                />
              }
            >
              {t("Face")}
            </TooltipTrigger>
            <TooltipContent>
              <ShortcutHint
                label={t("Fill the connected color in one face")}
                commands={["fill"]}
              />
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  value="everywhere"
                  className="pointer-coarse:h-9"
                  aria-keyshortcuts={editorShortcuts.fill.join(" ")}
                />
              }
            >
              {t("Everywhere")}
            </TooltipTrigger>
            <TooltipContent>
              <ShortcutHint
                label={t(
                  "Replace this color on all visible parts of the layer",
                )}
                commands={["fill"]}
              />
            </TooltipContent>
          </Tooltip>
        </ToggleGroup>
      )}
      {showMirror && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                variant="outline"
                size="sm"
                aria-label={t("Mirror")}
                aria-keyshortcuts={editorShortcuts.mirror.join(" ")}
                className="pointer-coarse:h-9 pointer-coarse:min-w-9"
                pressed={props.mirror}
                onPressedChange={props.onMirror}
              />
            }
          >
            <FlipHorizontal2 />
          </TooltipTrigger>
          <TooltipContent>
            <ShortcutHint
              label={t("Mirror left and right")}
              commands={["mirror"]}
            />
          </TooltipContent>
        </Tooltip>
      )}
      {usesBrush(props.tool) && (
        <div className="flex items-center gap-2">
          <span id={sizeId} className="text-xs text-muted-foreground">
            {t("Size")}
          </span>
          <div className="w-24">
            <Slider
              aria-labelledby={sizeId}
              aria-keyshortcuts={[
                ...editorShortcuts.smaller,
                ...editorShortcuts.larger,
              ].join(" ")}
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
            aria-keyshortcuts={editorShortcuts.shade.join(" ")}
          >
            <Sun />
            {t("Lighten")}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="darken"
            className="pointer-coarse:h-9"
            aria-keyshortcuts={editorShortcuts.shade.join(" ")}
          >
            <Moon />
            {t("Darken")}
          </ToggleGroupItem>
        </ToggleGroup>
      )}
      {props.tool === "shade" && (
        <ToggleGroup
          aria-label={t("Shade strength")}
          variant="outline"
          size="sm"
          spacing={0}
          value={[props.shadeStrength]}
          onValueChange={(value) => {
            if (value[0]) props.onShadeStrength(value[0] as ShadeStrength);
          }}
        >
          {shadeStrengths.map(({ value, label }) => (
            <ToggleGroupItem
              key={value}
              value={value}
              className="pointer-coarse:h-9"
            >
              {t(label)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
    </fieldset>
  );
}
