"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "fumadocs-ui/components/ui/popover";
import { InfoIcon, LoaderCircle, XIcon } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type CapeStatus, NO_CAPE_VALUE } from "@/lib/studio-options";
import type { MineSkinCape } from "@/lib/mineskin";
import { useT } from "@/lib/i18n-react";

/**
 * The MineSkin API key for the Official method. The key stays in form memory
 * only; the check button is the only request that uses it before Generate.
 */
export function MineSkinKeyField(props: {
  value: string;
  status: CapeStatus;
  invalid?: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
  onCheckCapeAccess: () => void;
}) {
  const t = useT();
  const id = useId();
  const statusId = `${id}-status`;
  const { status } = props;
  // A key without the capes grant is a field error, not a hint.
  const invalid = props.invalid || status === "denied";
  const hasStatus = status === "denied" || status === "granted";
  return (
    <Field data-invalid={invalid || undefined}>
      <div className="flex items-center gap-2">
        <FieldLabel htmlFor={id}>{t("capes.mineskinApiKey")}</FieldLabel>
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
            <span className="sr-only">{t("capes.mineskinApiKeyInfo")}</span>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={8}
            className="w-72 flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground"
          >
            <p>{t("capes.needApiKeyAllMineskinPlansExcept")}</p>
            <p>
              {t("capes.visit")}{" "}
              <a
                href="https://mineskin.org/apikey"
                className="font-medium text-foreground underline"
                target="_blank"
                rel="noreferrer"
              >
                {t("capes.mineskinApiKeysPage")}
              </a>{" "}
              {t("capes.getStartedSave10FirstThreeMonths")}{" "}
              <span className="font-mono font-semibold">
                {"SKINSRESTORER10"}
              </span>
              {t("capes.weDonTReceiveCommissionIfYou")}
            </p>
          </PopoverContent>
        </Popover>
      </div>
      <InputGroup>
        <InputGroupInput
          id={id}
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={t("capes.requiredCapeSupport")}
          aria-invalid={invalid || undefined}
          aria-describedby={hasStatus ? statusId : undefined}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          onBlur={props.onBlur}
        />
        <InputGroupAddon align="block-end">
          <InputGroupButton
            variant="outline"
            size="sm"
            className="ml-auto"
            disabled={status === "loading"}
            onClick={props.onCheckCapeAccess}
          >
            {status === "loading" && (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            )}
            {status === "loading"
              ? t("capes.checkingCapeSupport")
              : t("capes.checkCapeAccess")}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {status === "denied" && (
        <FieldError id={statusId}>
          {t("capes.capeSupportRequiresApiKeyCapesGrant")}
        </FieldError>
      )}
      {status === "granted" && (
        <FieldDescription id={statusId}>
          {t("capes.capeSupportEnabledApiKey")}
        </FieldDescription>
      )}
    </Field>
  );
}

/** Fixed placeholder slots while the cape list loads. */
const CAPE_PLACEHOLDERS = ["cape-slot-a", "cape-slot-b", "cape-slot-c"];

/**
 * The cape choice, always visible as a grid. "No cape" is a dotted outline.
 * Capes stay disabled while the chosen method cannot apply them. While the
 * list loads, placeholders keep its place; a failed load offers a retry.
 */
export function CapePicker(props: {
  capeOptionsDisabled: boolean;
  supportedCapes: MineSkinCape[];
  listStatus?: "loading" | "ready" | "failed";
  onRetryList?: () => void;
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
    { value: NO_CAPE_VALUE, label: t("common.noCape"), texture: undefined },
    ...props.supportedCapes.map((cape) => ({
      value: cape.uuid,
      label: cape.alias,
      texture: cape.url,
    })),
  ];
  const loading =
    props.listStatus === "loading" && props.supportedCapes.length === 0;
  const failed =
    props.listStatus === "failed" && props.supportedCapes.length === 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="max-h-36 overflow-y-auto p-0.5"
        aria-busy={loading || undefined}
      >
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
              // Not `disabled`: a click must reach onCapeChange, which explains
              // that capes need a checked API key.
              aria-disabled={
                (item.texture !== undefined && props.capeOptionsDisabled) ||
                undefined
              }
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
          {loading &&
            CAPE_PLACEHOLDERS.map((slot) => (
              <Skeleton key={slot} className="h-14 w-full" />
            ))}
        </ToggleGroup>
      </div>
      {loading && (
        <output className="text-xs text-muted-foreground">
          {t("capes.loadingCapes")}
        </output>
      )}
      {failed && (
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-destructive">
          {t("capes.failedLoadAvailableCapes")}
          {props.onRetryList && (
            <Button variant="link" size="sm" onClick={props.onRetryList}>
              {t("common.tryAgain")}
            </Button>
          )}
        </p>
      )}
      <p className="truncate text-xs text-muted-foreground" aria-live="polite">
        <span className="font-medium text-foreground">
          {selected?.alias ?? t("common.noCape")}
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
