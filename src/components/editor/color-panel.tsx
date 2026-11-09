"use client";

import { useEffect, useId, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type { Rgba } from "@/lib/skin-paint";
import type { SkinLayer } from "@/lib/skin-regions";

export function toHex(color: Rgba) {
  return `#${color
    .slice(0, 3)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function parseHex(value: string): [number, number, number] | undefined {
  const match = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(value.trim());
  if (!match) return undefined;
  const hex =
    match[1].length === 3 ? [...match[1]].map((c) => c + c).join("") : match[1];
  return [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

export function ColorPanel(props: {
  color: Rgba;
  layer: SkinLayer;
  recent: readonly Rgba[];
  onChange: (color: Rgba) => void;
}) {
  const { color, layer, recent, onChange } = props;
  const pickerId = useId();
  const hexId = useId();
  // Text being typed; the field shows the current color otherwise.
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const hexText = hexDraft ?? toHex(color);
  const hexValid = parseHex(hexText) !== undefined;
  const opacity = Math.round((color[3] / 255) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Color</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="flex items-end gap-3">
            <Field className="w-auto">
              <FieldLabel htmlFor={pickerId}>Swatch</FieldLabel>
              <input
                id={pickerId}
                type="color"
                value={toHex(color)}
                onChange={(event) => {
                  const rgb = parseHex(event.target.value);
                  if (rgb) onChange([...rgb, color[3]]);
                }}
                className="h-9 w-14 cursor-pointer rounded-md border bg-background p-1"
              />
            </Field>
            <Field data-invalid={!hexValid || undefined}>
              <FieldLabel htmlFor={hexId}>Hex code</FieldLabel>
              <Input
                id={hexId}
                value={hexText}
                spellCheck={false}
                autoComplete="off"
                aria-invalid={!hexValid || undefined}
                onChange={(event) => {
                  setHexDraft(event.target.value);
                  const rgb = parseHex(event.target.value);
                  if (rgb) onChange([...rgb, color[3]]);
                }}
                onBlur={() => setHexDraft(null)}
              />
            </Field>
          </div>
          <Field data-disabled={layer === "base" || undefined}>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel id={`${pickerId}-opacity`}>Opacity</FieldLabel>
              <span className="text-sm tabular-nums text-muted-foreground">
                {layer === "base" ? 100 : opacity}%
              </span>
            </div>
            <Slider
              aria-labelledby={`${pickerId}-opacity`}
              min={0}
              max={100}
              step={1}
              value={[layer === "base" ? 100 : opacity]}
              disabled={layer === "base"}
              onValueChange={(value) => {
                const next = Array.isArray(value) ? value[0] : value;
                onChange([
                  color[0],
                  color[1],
                  color[2],
                  Math.round((next / 100) * 255),
                ]);
              }}
            />
            {layer === "base" && (
              <FieldDescription>
                The base layer is always opaque.
              </FieldDescription>
            )}
          </Field>
          {recent.length > 0 && (
            <Field>
              <FieldTitle>Recent colors</FieldTitle>
              <ul className="flex flex-wrap gap-1.5">
                {recent.map((swatch) => {
                  const hex = toHex(swatch);
                  const key = `${hex}-${swatch[3]}`;
                  return (
                    <li key={key}>
                      <RecentSwatch
                        swatch={swatch}
                        label={`Use ${hex}${swatch[3] < 255 ? ` at ${Math.round((swatch[3] / 255) * 100)}% opacity` : ""}`}
                        onSelect={() => onChange(swatch)}
                      />
                    </li>
                  );
                })}
              </ul>
            </Field>
          )}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

/** The swatch color is data, so it is painted on a canvas, not with styles. */
function RecentSwatch(props: {
  swatch: Rgba;
  label: string;
  onSelect: () => void;
}) {
  const { swatch } = props;
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 2, 2);
    ctx.fillStyle = `rgba(${swatch[0]}, ${swatch[1]}, ${swatch[2]}, ${swatch[3] / 255})`;
    ctx.fillRect(0, 0, 2, 2);
  }, [canvas, swatch]);
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      onClick={props.onSelect}
      className="block size-7 overflow-hidden rounded-md border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <canvas ref={setCanvas} width={2} height={2} className="size-full" />
    </button>
  );
}
