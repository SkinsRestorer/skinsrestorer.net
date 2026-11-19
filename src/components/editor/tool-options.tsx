"use client";

import type { MessageKey } from "@/lib/messages";

import { FlipHorizontal2, Moon, Sun } from "lucide-react";
import { useId } from "react";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { usesBrush } from "@/components/editor/editor-types";
import {
  HintTrigger,
  ShortcutHints,
} from "@/components/editor/editor-commands";
import {
  editorShortcuts,
  useShortcutHints,
} from "@/components/editor/editor-shortcuts";
import {
  BRUSH_SIZES,
  type FillScope,
  type PaintTool,
  type ShadeMode,
  type ShadeStrength,
} from "@/lib/skin-paint";
import { useT } from "@/lib/i18n-react";
import { findOption } from "@/lib/utils";

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
  const hints = useShortcutHints();
  if (props.tool === "eyedropper") return null;
  // Everywhere replaces one exact color, so a mirror adds nothing to it.
  const showMirror = !(
    props.tool === "fill" && props.fillScope === "everywhere"
  );
  return (
    <fieldset className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
      <legend className="sr-only">{t("editor.toolOptions")}</legend>
      <ShortcutHints handle={hints} />
      {props.tool === "fill" && (
        <ToggleGroup
          aria-label={t("editor.fillArea")}
          variant="outline"
          size="sm"
          spacing={0}
          value={[props.fillScope]}
          onValueChange={(value) => {
            const scope = findOption(["face", "everywhere"], value[0]);
            if (scope) props.onFillScope(scope);
          }}
        >
          <HintTrigger
            hints={hints}
            label={t("editor.fillConnectedColorOneFace")}
            commands={["fill"]}
            render={
              <ToggleGroupItem
                value="face"
                className="pointer-coarse:h-9"
                aria-keyshortcuts={editorShortcuts.fill.join(" ")}
              />
            }
          >
            {t("editor.face")}
          </HintTrigger>
          <HintTrigger
            hints={hints}
            label={t("editor.replaceColorAllVisiblePartsLayer")}
            commands={["fill"]}
            render={
              <ToggleGroupItem
                value="everywhere"
                className="pointer-coarse:h-9"
                aria-keyshortcuts={editorShortcuts.fill.join(" ")}
              />
            }
          >
            {t("editor.everywhere")}
          </HintTrigger>
        </ToggleGroup>
      )}
      {showMirror && (
        <HintTrigger
          hints={hints}
          label={t("editor.mirrorLeftRight")}
          commands={["mirror"]}
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
        </HintTrigger>
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
              onValueChange={(value: number | readonly number[]) => {
                props.onSize(
                  typeof value === "number" ? value : (value[0] ?? props.size),
                );
              }}
            />
          </div>
          <span className="min-w-8 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
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
            const shade = findOption(["lighten", "darken"], value[0]);
            if (shade) props.onShade(shade);
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
            const strength = findOption(
              shadeStrengths.map((option) => option.value),
              value[0],
            );
            if (strength) props.onShadeStrength(strength);
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
