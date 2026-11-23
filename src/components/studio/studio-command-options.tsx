import { isMessageKey } from "@/lib/messages";

import { Check, Copy, LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { AdvancedOptions } from "@/components/advanced-options";
import { CapePicker, MineSkinKeyField } from "@/components/cape-support-fields";
import { ModelSelector } from "@/components/model-selector";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useT } from "@/lib/i18n-react";
import type { SkinVariant } from "@/lib/skin";
import type { SelectedSkin } from "@/lib/skin-selection";
import { defaultSkinName, suggestSkinName } from "@/lib/studio";
import type { UploadMethod } from "@/lib/studio-options";
import type { GenerationResult } from "@/lib/studio-generation";
import { cn, findOption } from "@/lib/utils";
import type { StudioCommandForm } from "./use-studio-command-form";

/** A two-way choice whose labels may wrap instead of overflowing. */
const wrappingToggle =
  "h-auto min-h-8 w-full min-w-0 text-center whitespace-normal";

/**
 * The options of the selected skin's command, its Generate button, and the
 * result. The form state lives in `useStudioCommandForm`.
 */
export function StudioCommandOptions(props: {
  command: StudioCommandForm;
  current: SelectedSkin;
  variant: SkinVariant;
  onVariant: (variant: SkinVariant) => void;
}) {
  const t = useT();
  const { command, current } = props;
  const { form, fixed, purpose, options, submitting, submitted, capes, shown } =
    command;
  const generateHintId = useId();
  const purposeHintId = useId();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  /** Wraps the MineSkin key field, for focus and its Enter key. */
  const keyField = useRef<HTMLDivElement>(null);
  const focusKeyField = useRef(false);
  // The "Open advanced options" link unmounts on click: move focus to the key.
  useEffect(() => {
    if (!advancedOpen || !focusKeyField.current) return;
    focusKeyField.current = false;
    keyField.current?.querySelector("input")?.focus();
  }, [advancedOpen]);

  // A finished upload moves focus to its result, so keyboard and screen
  // reader users land on the command, and phones scroll to it.
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const generateButton = useRef<HTMLButtonElement>(null);
  /** After "Stop waiting" or a failure, once the button is enabled again. */
  const refocusGenerate = useRef(false);
  const previousStatus = useRef(shown.status);
  useEffect(() => {
    const before = previousStatus.current;
    previousStatus.current = shown.status;
    if (before !== "pending") return;
    if (shown.status === "done") resultHeading.current?.focus();
    // The disabled button lost focus while waiting. Return it, so the
    // user can try again, unless they moved focus elsewhere.
    else if (
      shown.status === "failed" &&
      (!document.activeElement || document.activeElement === document.body)
    )
      refocusGenerate.current = true;
  }, [shown.status]);
  useEffect(() => {
    if (!refocusGenerate.current || submitting) return;
    refocusGenerate.current = false;
    generateButton.current?.focus();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- A new status can enable the button again.
  }, [submitting, shown.status]);
  return (
    <>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <FieldGroup>
          <div className="flex flex-col gap-1.5">
            {fixed ? (
              <h2 className="text-base font-semibold">
                {fixed === "createcustom"
                  ? t("studio.createCustomSkin")
                  : t("common.useServer")}
              </h2>
            ) : (
              <form.Field name="purpose">
                {(field) => (
                  <ToggleGroup
                    aria-label={t("studio.purpose")}
                    aria-describedby={purposeHintId}
                    variant="outline"
                    spacing={0}
                    className="grid w-full grid-cols-2"
                    value={[field.state.value]}
                    onValueChange={(value) => {
                      const next = findOption(
                        ["skin-url", "createcustom"],
                        value[0],
                      );
                      if (next) field.handleChange(next);
                    }}
                  >
                    <ToggleGroupItem
                      value="skin-url"
                      className={wrappingToggle}
                    >
                      <span className="py-1">{t("common.useServer")}</span>
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="createcustom"
                      className={wrappingToggle}
                    >
                      <span className="py-1">{t("studio.customSkin")}</span>
                    </ToggleGroupItem>
                  </ToggleGroup>
                )}
              </form.Field>
            )}
            {/* Say what the command does before anything uploads. */}
            <FieldDescription id={purposeHintId}>
              {t(
                purpose === "createcustom"
                  ? "studio.createcustomPurposeHint"
                  : "studio.skinUrlPurposeHint",
              )}
            </FieldDescription>
          </div>

          {purpose === "createcustom" && (
            <form.Field name="customName">
              {(field) => {
                const errors =
                  field.state.meta.isTouched || submitted
                    ? field.state.meta.errors
                    : [];
                // Offer the valid form of the typed name, such as my_skin.
                const suggestion = suggestSkinName(field.state.value);
                return (
                  <TextField
                    // The placeholder repeats the file name, which can hold a
                    // texture hash.
                    className="ph-no-capture"
                    label={t("studio.skinNameOptional")}
                    description={t("studio.skinNameHint")}
                    value={field.state.value}
                    placeholder={defaultSkinName(current.file.name)}
                    errors={errors}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                    fix={
                      errors.length > 0 &&
                      suggestion && (
                        <Button
                          variant="link"
                          size="sm"
                          className="self-start"
                          // This link unmounts; focus returns to the name.
                          onClick={(event) => {
                            const input = event.currentTarget
                              .closest('[data-slot="field"]')
                              ?.querySelector("input");
                            field.handleChange(suggestion);
                            input?.focus();
                          }}
                        >
                          {t("studio.useSuggestedName", { name: suggestion })}
                        </Button>
                      )
                    }
                  />
                );
              }}
            </form.Field>
          )}

          <ChoiceSet label={t("common.model")}>
            {(labelId) => (
              <ModelSelector
                aria-labelledby={labelId}
                layout="stacked"
                value={props.variant}
                onValueChange={props.onVariant}
              />
            )}
          </ChoiceSet>

          <form.Field name="capeUuid">
            {(field) => (
              <ChoiceSet label={t("studio.cape")}>
                {(labelId) => (
                  <CapePicker
                    labelledBy={labelId}
                    capeOptionsDisabled={capes.capeOptionsDisabled}
                    supportedCapes={capes.supportedCapes}
                    listStatus={capes.listStatus}
                    onRetryList={capes.retryList}
                    selectedCapeUuid={field.state.value}
                    onCapeChange={command.chooseCape}
                    keyHint={
                      options.method === "mineskin" &&
                      capes.status !== "granted" && (
                        <p className="text-xs text-muted-foreground">
                          {t("studio.loadCapeSupportValidApiKeyUnder")}{" "}
                          {!advancedOpen && (
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => {
                                focusKeyField.current = true;
                                setAdvancedOpen(true);
                              }}
                            >
                              {t("studio.openAdvancedOptions")}
                            </Button>
                          )}
                        </p>
                      )
                    }
                  />
                )}
              </ChoiceSet>
            )}
          </form.Field>
        </FieldGroup>

        {/* The command form removes a cape that the method cannot apply. */}
        <form.Field name="method">
          {(methodField) => (
            <AdvancedOptions
              method={methodField.state.value}
              onMethodChange={(value: UploadMethod) => {
                methodField.handleChange(value);
              }}
              open={advancedOpen}
              onOpenChange={setAdvancedOpen}
              officialFields={
                <form.Field
                  name="apiKey"
                  listeners={{
                    // A new key needs a new check before capes.
                    onChange: capes.reset,
                  }}
                >
                  {(field) => (
                    <div ref={keyField} className="contents">
                      <MineSkinKeyField
                        value={field.state.value}
                        status={capes.status}
                        noCapes={capes.supportedCapes.length === 0}
                        onChange={field.handleChange}
                        onBlur={field.handleBlur}
                        onCheckCapeAccess={() =>
                          void capes.verify(field.state.value.trim())
                        }
                      />
                    </div>
                  )}
                </form.Field>
              }
            />
          )}
        </form.Field>

        <div className="flex flex-col gap-1.5">
          <Button
            ref={generateButton}
            type="submit"
            // Long translations wrap in the narrow options column.
            className="h-auto min-h-9 w-full whitespace-normal"
            disabled={
              !command.input ||
              !!command.pendingGallery ||
              command.nameInvalid ||
              submitting ||
              shown.status === "pending" ||
              // The same choices give the same command: no second upload.
              shown.status === "done"
            }
            aria-describedby={command.generateHint ? generateHintId : undefined}
          >
            {shown.status === "pending" ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              shown.status === "done" && <Check data-icon="inline-start" />
            )}
            {shown.status === "pending"
              ? t("studio.generating")
              : shown.status === "done"
                ? t("studio.commandReady")
                : purpose === "createcustom"
                  ? t("studio.generateSrCreatecustom")
                  : t("studio.generateSkinUrl")}
          </Button>
          <output
            id={generateHintId}
            className="flex min-h-4 flex-wrap items-center justify-center gap-x-2 text-center text-xs text-muted-foreground"
          >
            {command.generateHint && t(command.generateHint)}
            {shown.status === "pending" && (
              <Button
                variant="link"
                size="sm"
                // This link unmounts; focus returns to the button.
                onClick={() => {
                  refocusGenerate.current = true;
                  command.stopWaiting();
                }}
              >
                {t("studio.stopWaiting")}
              </Button>
            )}
          </output>
        </div>
      </form>

      {shown.status === "failed" && (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>{t("studio.skinNotUploaded")}</AlertTitle>
          <AlertDescription>
            <p>{t.message(shown.message)}</p>
            <p>
              {t(
                options.method === "axolotl"
                  ? "studio.uploadFailedTryAgainOrOfficial"
                  : "studio.uploadFailedTryAgainCheckKey",
              )}
            </p>
          </AlertDescription>
        </Alert>
      )}
      {shown.status === "done" && (
        <Result result={shown.result} ref={resultHeading} />
      )}
    </>
  );
}

/**
 * A titled choice, such as the model or the cape. The toggle group inside
 * is the only group and takes its name from the title, so screen readers
 * do not announce the same name twice.
 */
function ChoiceSet(props: {
  label: string;
  children: (labelId: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <FieldTitle id={id}>{props.label}</FieldTitle>
      {props.children(id)}
    </div>
  );
}

/** A text field with a label and its validation messages. */
function TextField(props: {
  label: string;
  description?: string;
  value: string;
  placeholder?: string;
  className?: string;
  errors?: readonly unknown[] | undefined;
  /** A one-click correction shown under the error. */
  fix?: React.ReactNode;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const invalid = !!props.errors?.length;
  return (
    <Field data-invalid={invalid || undefined} className={props.className}>
      <FieldLabel htmlFor={id}>{props.label}</FieldLabel>
      <Input
        id={id}
        value={props.value}
        placeholder={props.placeholder}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={invalid || undefined}
        aria-describedby={props.description ? descriptionId : undefined}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
        onBlur={props.onBlur}
      />
      {props.description && (
        <FieldDescription id={descriptionId}>
          {props.description}
        </FieldDescription>
      )}
      <LocalizedFieldError errors={props.errors} />
      {props.fix}
    </Field>
  );
}

/** Validation messages use stable keys; show them in the page language. */
function LocalizedFieldError(props: {
  errors?: readonly unknown[] | undefined;
}) {
  const t = useT();
  const errors = props.errors
    ?.filter(isMessageKey)
    .map((message) => ({ message: t(message) }));
  return <FieldError {...(errors === undefined ? {} : { errors })} />;
}

function Result(props: {
  result: GenerationResult;
  /** The heading that takes focus when a new result arrives. */
  ref: React.Ref<HTMLHeadingElement>;
}) {
  const t = useT();
  const { result, ref } = props;
  return (
    // The command and URL name the uploaded texture; keep them out of
    // session replays.
    <div className="flex flex-col gap-3 border-t pt-3.5 ph-no-capture">
      <div className="flex flex-col gap-0.5">
        <h3
          ref={ref}
          tabIndex={-1}
          className="flex items-center gap-1.5 text-sm font-semibold outline-none"
        >
          <Check aria-hidden="true" className="size-4 text-chart-2" />
          {t("studio.commandReadyTitle")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t("studio.commandReadyHint")}
        </p>
      </div>
      <CopyField label={t("studio.command")} value={result.command} />
      <CopyField
        label={t("studio.skinUrl")}
        value={result.textureUrl ?? result.url}
        oneLine
      />
    </div>
  );
}

function CopyField(props: { label: string; value: string; oneLine?: boolean }) {
  const t = useT();
  const id = useId();
  const [copied, setCopied] = useState(false);
  useEffect((): (() => void) | undefined => {
    if (!copied) return undefined;
    const timer = setTimeout(() => {
      setCopied(false);
    }, 1400);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.value);
      setCopied(true);
      // The icon change alone is easy to miss.
      toast.success(t("common.copiedClipboard"), {
        id: `copy-${id}`,
      });
    } catch {
      // Clicking the text selects all of it for a manual copy.
      toast.error(t("common.failedCopy"), {
        description: t("studio.selectTextToCopy"),
      });
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-sm font-medium">
        {props.label}
      </span>
      <div className="relative">
        <code
          aria-labelledby={id}
          title={props.oneLine ? props.value : undefined}
          className={cn(
            "block rounded-lg border bg-muted py-2 pr-10 pl-2.5 font-mono text-xs/relaxed select-all",
            props.oneLine ? "truncate" : "break-all",
          )}
        >
          {props.value}
        </code>
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-0.5 right-0.5"
          aria-label={t("studio.copyItem", { item: props.label })}
          onClick={() => void copy()}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </div>
  );
}
