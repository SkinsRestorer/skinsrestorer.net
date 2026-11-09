"use client";

import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type { Rgba } from "@/lib/skin-paint";
import type { SkinLayer } from "@/lib/skin-regions";
import { useT } from "@/lib/i18n-react";

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

/**
 * The paint color in one compact row: a swatch picker, a hex field, opacity
 * for the outer layer, and recent colors.
 */
export function ColorControls(props: {
  color: Rgba;
  layer: SkinLayer;
  recent: readonly Rgba[];
  onChange: (color: Rgba) => void;
}) {
  const t = useT();
  const { color, layer, recent, onChange } = props;
  const opacityId = useId();
  // Text being typed; the field shows the current color otherwise.
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const hexText = hexDraft ?? toHex(color);
  const hexValid = parseHex(hexText) !== undefined;
  const opacity = Math.round((color[3] / 255) * 100);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="color"
        aria-label={t("editor.paintColor")}
        value={toHex(color)}
        onChange={(event) => {
          const rgb = parseHex(event.target.value);
          if (rgb) onChange([...rgb, color[3]]);
        }}
        className="h-8 w-10 cursor-pointer rounded-md border bg-background p-0.5"
      />
      <Input
        aria-label={t("editor.hexCode")}
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
        className="h-8 w-24"
      />
      {layer === "outer" && (
        <div className="flex min-w-36 flex-1 items-center gap-2">
          <span id={opacityId} className="text-xs text-muted-foreground">
            {t("editor.opacity")}
          </span>
          <Slider
            aria-labelledby={opacityId}
            min={0}
            max={100}
            step={1}
            value={[opacity]}
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
          <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
            {opacity}%
          </span>
        </div>
      )}
      {recent.length > 0 && (
        <ul
          aria-label={t("editor.recentColors")}
          className="flex flex-wrap gap-1"
        >
          {recent.map((swatch) => {
            const hex = toHex(swatch);
            const key = `${hex}-${swatch[3]}`;
            return (
              <li key={key}>
                <RecentSwatch
                  swatch={swatch}
                  label={t("editor.useColorOpacityOpacity", {
                    color: hex,
                    opacity: Math.round((swatch[3] / 255) * 100),
                  })}
                  onSelect={() => onChange(swatch)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
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
      className="block size-6 overflow-hidden rounded-md border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <canvas ref={setCanvas} width={2} height={2} className="size-full" />
    </button>
  );
}
