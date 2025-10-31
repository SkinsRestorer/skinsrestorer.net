"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "fumadocs-ui/components/ui/popover";
import { InfoIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type CapeStatus, NO_CAPE_VALUE } from "@/lib/hooks/use-cape-selection";
import type { MineSkinCape } from "@/lib/mineskin";

interface CapeSupportFieldsProps {
  apiKey: string;
  capeStatus: CapeStatus;
  capeOptionsDisabled: boolean;
  supportedCapes: MineSkinCape[];
  selectedCapeUuid: string;
  onApiKeyChange: (value: string) => void;
  onCheckCapeAccess: () => void;
  onCapeChange: (value: string) => void;
}

export function CapeSupportFields({
  apiKey,
  capeStatus,
  capeOptionsDisabled,
  supportedCapes,
  selectedCapeUuid,
  onApiKeyChange,
  onCheckCapeAccess,
  onCapeChange,
}: CapeSupportFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="mineskin-api-key">MineSkin API key</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground"
              >
                <InfoIcon className="h-4 w-4" aria-hidden />
                <span className="sr-only">MineSkin API key info</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              sideOffset={8}
              className="w-72 space-y-2 text-sm leading-relaxed text-muted-foreground"
            >
              <p>
                Need an API key? All MineSkin plans except Lite include cape
                generation, higher limits, and exclusive features.
              </p>
              <p>
                Visit the{" "}
                <a
                  href="https://mineskin.org/apikey"
                  className="font-medium text-foreground underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  MineSkin API keys page
                </a>{" "}
                to get started and save 10% on your first three months (plans
                except Lite) with the exclusive coupon code{" "}
                <span className="font-mono font-semibold">SKINSRESTORER10</span>
                . We don't receive a commission if you use this coupon—it's just
                a community perk.
              </p>
            </PopoverContent>
          </Popover>
        </div>
        <Input
          id="mineskin-api-key"
          type="password"
          placeholder="Required for cape support"
          value={apiKey}
          onChange={(event) => {
            onApiKeyChange(event.target.value);
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={onCheckCapeAccess}
          disabled={capeStatus === "loading"}
        >
          {capeStatus === "loading"
            ? "Checking cape support..."
            : "Check cape access"}
        </Button>
        {capeStatus === "denied" && (
          <p className="text-xs text-muted-foreground">
            Cape support requires an API key with the capes grant.
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="cape-select">Cape (optional)</Label>
        <Select value={selectedCapeUuid} onValueChange={onCapeChange}>
          <SelectTrigger id="cape-select">
            <SelectValue placeholder="No cape" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CAPE_VALUE}>No cape</SelectItem>
            {supportedCapes.map((cape) => (
              <SelectItem
                key={cape.uuid}
                value={cape.uuid}
                disabled={capeOptionsDisabled}
              >
                <div className="flex items-center gap-2">
                  <CapePreview texture={cape.url} />
                  <span>{cape.alias}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {capeStatus !== "granted" && (
          <p className="text-xs text-muted-foreground">
            Load cape support with a valid API key to preview and apply capes.
          </p>
        )}
      </div>
    </>
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
      const currentCanvas = canvasRef.current;
      const currentContext = currentCanvas?.getContext("2d");
      if (!currentCanvas || !currentContext) {
        return;
      }

      currentCanvas.width = width;
      currentCanvas.height = height;
      currentContext.imageSmoothingEnabled = false;
      currentContext.clearRect(0, 0, width, height);
      currentContext.drawImage(image, 1, 1, width, height, 0, 0, width, height);
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
      className="h-8 w-5 shrink-0 rounded border border-border bg-muted [image-rendering:pixelated]"
    />
  );
}
