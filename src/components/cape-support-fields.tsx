"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "fumadocs-ui/components/ui/popover";
import { InfoIcon, XIcon } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type CapeStatus, NO_CAPE_VALUE } from "@/lib/hooks/use-cape-selection";
import type { MineSkinCape } from "@/lib/mineskin";
import { useT } from "@/lib/i18n-react";

/** The MineSkin API key for the Official method. It stays in form state only. */
export function MineSkinKeyFields(props: {
  apiKey: string;
  capeStatus: CapeStatus;
  onApiKeyChange: (value: string) => void;
  onCheckCapeAccess: () => void;
}) {
  const t = useT();
  const mineskinApiKeyId = useId();
  const { apiKey, capeStatus } = props;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={mineskinApiKeyId}>{t("MineSkin API key")}</Label>
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground"
              />
            }
          >
            <InfoIcon className="h-4 w-4" aria-hidden />
            <span className="sr-only">{t("MineSkin API key info")}</span>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={8}
            className="w-72 flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground"
          >
            <p>
              {t(
                "Need an API key? All MineSkin plans except Lite include cape generation, higher limits, and exclusive features.",
              )}
            </p>
            <p>
              {t("Visit the")}{" "}
              <a
                href="https://mineskin.org/apikey"
                className="font-medium text-foreground underline"
                target="_blank"
                rel="noreferrer"
              >
                {t("MineSkin API keys page")}
              </a>{" "}
              {t(
                "to get started and save 10% on your first three months (plans except Lite) with the exclusive coupon code",
              )}{" "}
              <span className="font-mono font-semibold">
                {t("SKINSRESTORER10")}
              </span>
              {t(
                ". We don't receive a commission if you use this coupon—it's just a community perk.",
              )}
            </p>
          </PopoverContent>
        </Popover>
      </div>
      <Input
        id={mineskinApiKeyId}
        type="password"
        placeholder={t("Required for cape support")}
        value={apiKey}
        onChange={(event) => {
          props.onApiKeyChange(event.target.value);
        }}
      />
      <Button
        type="button"
        variant="outline"
        onClick={props.onCheckCapeAccess}
        disabled={capeStatus === "loading"}
      >
        {capeStatus === "loading"
          ? t("Checking cape support...")
          : t("Check cape access")}
      </Button>
      {capeStatus === "denied" && (
        <p className="text-xs text-muted-foreground">
          {t("Cape support requires an API key with the capes grant.")}
        </p>
      )}
    </div>
  );
}

/**
 * The cape choice, always visible as a grid. "No cape" is a dotted outline.
 * Capes stay disabled while the chosen method cannot apply them.
 */
export function CapePicker(props: {
  capeOptionsDisabled: boolean;
  supportedCapes: MineSkinCape[];
  selectedCapeUuid: string;
  onCapeChange: (value: string) => void;
  /** Official needs a key with the capes grant; offer to open the key field. */
  keyHint?: ReactNode;
  labelledBy?: string;
}) {
  const t = useT();
  const selected = props.supportedCapes.find(
    (cape) => cape.uuid === props.selectedCapeUuid,
  );
  const items = [
    { value: NO_CAPE_VALUE, label: t("No cape"), texture: undefined },
    ...props.supportedCapes.map((cape) => ({
      value: cape.uuid,
      label: cape.alias,
      texture: cape.url,
    })),
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="max-h-36 overflow-y-auto p-0.5">
        <ToggleGroup
          aria-labelledby={props.labelledBy}
          variant="outline"
          spacing={1.5}
          className="grid w-full grid-cols-4"
          value={[props.selectedCapeUuid]}
          onValueChange={(value) => {
            if (value[0]) props.onCapeChange(value[0]);
          }}
        >
          {items.map((item) => (
            <ToggleGroupItem
              key={item.value}
              value={item.value}
              aria-label={item.label}
              title={item.label}
              disabled={item.texture !== undefined && props.capeOptionsDisabled}
              className="h-14 w-full min-w-0"
            >
              {item.texture ? (
                <CapePreview texture={item.texture} />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-10 w-[1.5625rem] items-center justify-center rounded-xs border border-dashed border-muted-foreground text-muted-foreground"
                >
                  <XIcon className="size-3.5" />
                </span>
              )}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <p className="truncate text-xs text-muted-foreground" aria-live="polite">
        <span className="font-medium text-foreground">
          {selected?.alias ?? t("No cape")}
        </span>
      </p>
      {props.keyHint}
    </div>
  );
}

function CapePreview({ texture }: { texture: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const width = 10;
    const height = 16;

    canvas.width = width;
    canvas.height = height;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, width, height);

    if (!texture) {
      return;
    }

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      context.drawImage(image, 1, 1, width, height, 0, 0, width, height);
    };
    image.src = texture;

    return () => {
      image.onload = null;
    };
  }, [texture]);

  return (
    <canvas
      ref={canvasRef}
      width={10}
      height={16}
      aria-hidden="true"
      className="h-10 w-[1.5625rem] shrink-0 [image-rendering:pixelated]"
    />
  );
}
