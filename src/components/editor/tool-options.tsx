"use client";

import type { MessageKey } from "@/lib/messages";

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

const shadeStrengths: ReadonlyArray<{
  value: ShadeStrength;
  label: MessageKey;
}> = [
  { value: "soft", label: "editor.soft" },
  { value: "medium", label: "editor.medium" },
  { value: "strong", label: "editor.strong" },
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
      <legend className="sr-only">{t("editor.toolOptions")}</legend>
      {props.tool === "fill" && (
        <ToggleGroup
          aria-label={t("editor.fillArea")}
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
              {t("editor.face")}
            </TooltipTrigger>
            <TooltipContent>
              <ShortcutHint
                label={t("editor.fillConnectedColorOneFace")}
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
              {t("editor.everywhere")}
            </TooltipTrigger>
            <TooltipContent>
              <ShortcutHint
                label={t("editor.replaceColorAllVisiblePartsLayer")}
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
                aria-label={t("editor.mirror")}
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
              label={t("editor.mirrorLeftRight")}
              commands={["mirror"]}
            />
          </TooltipContent>
        </Tooltip>
      )}
      {usesBrush(props.tool) && (
        <div className="flex items-center gap-2">
          <span id={sizeId} className="text-xs text-muted-foreground">
            {t("editor.size")}
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
            {t("editor.sizePx", { size: props.size })}
          </span>
        </div>
      )}
      {props.tool === "shade" && (
        <ToggleGroup
          aria-label={t("common.shade")}
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
            {t("editor.lighten")}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="darken"
            className="pointer-coarse:h-9"
            aria-keyshortcuts={editorShortcuts.shade.join(" ")}
          >
            <Moon />
            {t("editor.darken")}
          </ToggleGroupItem>
        </ToggleGroup>
      )}
      {props.tool === "shade" && (
        <ToggleGroup
          aria-label={t("editor.shadeStrength")}
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
