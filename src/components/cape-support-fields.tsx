"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "fumadocs-ui/components/ui/popover";
import { InfoIcon, LoaderCircle, XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

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
import { runSkinEffect, withSkinImageEffect } from "@/lib/skin";
import { cn } from "@/lib/utils";

/**
 * The MineSkin API key for the Official method. The key stays in form memory
 * only; the check button is the only request that uses it before Generate.
 */
export function MineSkinKeyField(props: {
  value: string;
  status: CapeStatus;
  onChange: (value: string) => void;
  onBlur: () => void;
  onCheckCapeAccess: () => void;
}) {
  const t = useT();
  const id = useId();
  const statusId = `${id}-status`;
  const { status } = props;
  // A key without the capes grant is a field error, not a hint.
  const invalid = status === "denied";
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
                className="size-6 text-muted-foreground"
              />
            }
          >
            <InfoIcon className="size-4" aria-hidden />
            <span className="sr-only">{t("capes.mineskinApiKeyInfo")}</span>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={8}
            className="flex w-72 flex-col gap-2 text-sm/relaxed text-muted-foreground"
          >
            <p>{t("capes.needApiKeyAllMineskinPlansExcept")}</p>
            <p>
              {t.rich("capes.mineskinCoupon", {
                link: (
                  // oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- t.rich fills in the link text.
                  <a
                    href="https://mineskin.org/apikey"
                    className="font-medium text-foreground underline"
                    target="_blank"
                    rel="noreferrer"
                  />
                ),
                code: (
                  <span className="font-mono font-semibold">
                    SKINSRESTORER10
                  </span>
                ),
              })}
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
          onChange={(event) => {
            props.onChange(event.target.value);
          }}
          onBlur={props.onBlur}
          onKeyDown={(event) => {
            // Enter checks cape access. It never submits the form.
            if (event.key !== "Enter") return;
            event.preventDefault();
            props.onCheckCapeAccess();
          }}
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

/** Enough slots to fill the list's full height, so loading does not shift it. */
const CAPE_PLACEHOLDERS = Array.from(
  { length: 11 },
  (_, slot) => `cape-slot-${slot}`,
);

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
        className={cn(
          "max-h-36 overflow-y-auto p-0.5",
          // The loaded list fills this height, so the page keeps its layout.
          loading && "h-36 overflow-hidden",
        )}
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
                  className="flex h-10 w-6.25 items-center justify-center rounded-xs border border-dashed border-muted-foreground text-muted-foreground"
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
      {failed && (
        <p
          role="alert"
          className="flex flex-wrap items-center gap-x-2 text-xs text-destructive"
        >
          {t("capes.failedLoadAvailableCapes")}
          {props.onRetryList && (
            <Button variant="link" size="sm" onClick={props.onRetryList}>
              {t("common.tryAgain")}
            </Button>
          )}
        </p>
      )}
      {loading ? (
        // Uses the selected cape's line, so no line appears and disappears.
        <output className="truncate text-xs text-muted-foreground">
          {t("capes.loadingCapes")}
        </output>
      ) : (
        <p
          className="truncate text-xs text-muted-foreground"
          aria-live="polite"
        >
          <span className="font-medium text-foreground">
            {selected?.alias ?? t("common.noCape")}
          </span>
        </p>
      )}
      {props.keyHint}
    </div>
  );
}

function CapePreview({ texture }: { texture: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failedTexture, setFailedTexture] = useState<string | null>(null);
  const failed = failedTexture === texture;

  useEffect((): (() => void) | undefined => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !texture) return undefined;

    const width = 10;
    const height = 16;
    canvas.width = width;
    canvas.height = height;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, width, height);

    // The load owns its image and releases its handlers when cancelled.
    const owner = new AbortController();
    runSkinEffect(
      withSkinImageEffect(texture, (image) => {
        if (owner.signal.aborted) return;
        context.drawImage(image, 1, 1, width, height, 0, 0, width, height);
      }),
      owner.signal,
    ).catch(() => {
      if (!owner.signal.aborted) setFailedTexture(texture);
    });
    return () => {
      owner.abort();
    };
  }, [texture]);

  if (failed)
    return (
      <span
        aria-hidden="true"
        className="h-10 w-6.25 shrink-0 rounded-xs border border-dashed border-muted-foreground"
      />
    );
  return (
    <canvas
      ref={canvasRef}
      width={10}
      height={16}
      aria-hidden="true"
      className="h-10 w-6.25 shrink-0 [image-rendering:pixelated]"
    />
  );
}
