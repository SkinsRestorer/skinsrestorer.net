"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SkinVariant } from "@/lib/skin";
import { cn } from "@/lib/utils";

const models = [
  { value: "classic", label: "Classic", detail: "4 px arms", arm: 4 },
  { value: "slim", label: "Slim", detail: "3 px arms", arm: 3 },
] as const;

/**
 * A pixel drawing of a Minecraft upper body, drawn on the skin's own grid:
 * an 8×8 head, an 8 px wide body, and arms 4 or 3 px wide.
 */
function ModelIcon({ arm }: { arm: 3 | 4 }) {
  const left = 6 - arm;
  return (
    <svg
      viewBox="0 0 20 21"
      aria-hidden="true"
      className="size-11 shrink-0 [shape-rendering:crispEdges]"
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

/** Pick Classic or Slim. Both pages and the editor use this control. */
export function ModelSelector(props: {
  value: SkinVariant;
  onValueChange: (value: SkinVariant) => void;
  className?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <ToggleGroup
      aria-labelledby={props["aria-labelledby"]}
      variant="outline"
      spacing={0}
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
          aria-label={`${model.label}, ${model.arm} pixel arms`}
          className="h-auto min-h-16 justify-center"
        >
          <span className="flex items-center gap-3 py-2">
            <ModelIcon arm={model.arm} />
            <span className="flex flex-col items-start gap-0.5">
              <span className="text-sm font-semibold">{model.label}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {model.detail}
              </span>
            </span>
          </span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
