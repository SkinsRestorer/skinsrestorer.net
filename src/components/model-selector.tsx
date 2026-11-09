"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SkinVariant } from "@/lib/skin";
import { useT } from "@/lib/i18n-react";
import { cn } from "@/lib/utils";

const models = [
  {
    value: "classic",
    label: "model.classic",
    detail: "model.classicArms",
    arm: 4,
  },
  { value: "slim", label: "model.slim", detail: "model.slimArms", arm: 3 },
] as const;

/**
 * A pixel drawing of a Minecraft upper body, drawn on the skin's own grid:
 * an 8×8 head, an 8 px wide body, and arms 4 or 3 px wide.
 */
function ModelIcon({ arm, className }: { arm: 3 | 4; className?: string }) {
  const left = 6 - arm;
  return (
    <svg
      viewBox="0 0 20 21"
      aria-hidden="true"
      className={cn("size-11 shrink-0 [shape-rendering:crispEdges]", className)}
    >
      <rect
        className="fill-muted-foreground"
        x="6"
        y="1"
        width="8"
        height="8"
      />
      <path className="fill-background" d="M8 5h1v1H8zM11 5h1v1h-1z" />
      <rect className="fill-foreground/50" x="6" y="9" width="8" height="12" />
      {[left, 14].map((x) => (
        <g key={x}>
          <rect
            className="fill-foreground/50"
            x={x}
            y="9"
            width={arm}
            height="4"
          />
          <rect className="fill-chart-2" x={x} y="13" width={arm} height="8" />
          {Array.from({ length: arm - 1 }, (_, i) => x + i + 1).map(
            (column) => (
              <path
                key={column}
                className="stroke-background opacity-45"
                strokeWidth="0.4"
                d={`M${column} 13v8`}
              />
            ),
          )}
        </g>
      ))}
    </svg>
  );
}

/**
 * Pick Classic or Slim. The stacked layout puts the icon above the name for
 * narrow panels; the accessible name always says the arm width.
 */
export function ModelSelector(props: {
  value: SkinVariant;
  onValueChange: (value: SkinVariant) => void;
  className?: string;
  layout?: "row" | "stacked";
  disabled?: boolean;
  "aria-labelledby"?: string;
}) {
  const stacked = props.layout === "stacked";
  const t = useT();
  return (
    <ToggleGroup
      aria-labelledby={props["aria-labelledby"]}
      variant="outline"
      spacing={stacked ? 2 : 0}
      disabled={props.disabled}
      className={cn("grid w-full grid-cols-2", props.className)}
      value={[props.value]}
      onValueChange={(value) => {
        if (value[0]) props.onValueChange(value[0] as SkinVariant);
      }}
    >
      {models.map((model) => (
        <ToggleGroupItem
          key={model.value}
          value={model.value}
          aria-label={t("model.accessibleLabel", {
            model: t(model.label),
            width: model.arm,
          })}
          className={cn(
            "h-auto justify-center",
            stacked ? "min-h-0 w-full" : "min-h-16",
          )}
        >
          {stacked ? (
            <span className="flex flex-col items-center gap-1 pt-2 pb-1.5">
              <ModelIcon arm={model.arm} className="h-10 w-10" />
              <span className="text-xs font-medium">{t(model.label)}</span>
            </span>
          ) : (
            <span className="flex items-center gap-3 py-2">
              <ModelIcon arm={model.arm} />
              <span className="flex flex-col items-start gap-0.5">
                <span className="text-sm font-semibold">{t(model.label)}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {t(model.detail)}
                </span>
              </span>
            </span>
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
