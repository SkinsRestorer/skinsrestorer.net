import type { MessageKey } from "@/lib/messages";

import { useForm, useSelector } from "@tanstack/react-form";
import { analytics } from "@/lib/analytics";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import { useCapeAccess } from "@/lib/hooks/use-cape-access";
import { useStudioGeneration } from "@/lib/hooks/use-studio-generation";
import { useT } from "@/lib/i18n-react";
import type { SkinVariant } from "@/lib/skin";
import type { GenerationInput, SelectedSkin } from "@/lib/skin-selection";
import {
  fixedPurpose,
  type StudioEntry,
  type StudioPurpose,
} from "@/lib/studio";
import {
  defaultStudioOptions,
  NO_CAPE_VALUE,
  normalizeStudioOptions,
  studioOptionErrors,
  uploadRoute,
  type CapeStatus,
  type StudioOptions,
} from "@/lib/studio-options";

/**
 * The options form of the selected skin's command and its generation.
 * Nothing uploads before the user submits, and a failure is never sent
 * again on its own.
 */
export function useStudioCommandForm(props: {
  readonly entry: StudioEntry;
  readonly intent: StudioPurpose | undefined;
  /** The checked file to send, or null while there is none. */
  readonly file: File | null;
  readonly variant: SkinVariant;
  readonly current: SelectedSkin | null;
  /** A gallery skin that is still opening. */
  readonly pendingGallery: string | undefined;
}) {
  const t = useT();
  const { current, pendingGallery } = props;
  const generation = useStudioGeneration();
  const fixed = fixedPurpose(props.entry, props.intent);
  const capeStatusRef = useRef<CapeStatus>("granted");
  const purposeRef = useRef<StudioPurpose>("skin-url");
  const submitRef = useRef<(options: StudioOptions) => Promise<void>>(
    async () => {},
  );
  const form = useForm({
    defaultValues: defaultStudioOptions,
    validators: {
      onChange: ({ value }) => optionErrors(value),
      onSubmit: ({ value }) => optionErrors(value),
    },
    onSubmit: ({ value }) => submitRef.current(value),
  });
  function optionErrors(value: StudioOptions) {
    const fields = studioOptionErrors(value, {
      purpose: purposeRef.current,
      capeStatus: capeStatusRef.current,
    });
    return Object.keys(fields).length > 0 ? { fields } : undefined;
  }
  const options = useSelector(form.store, (formState) => formState.values);
  const submitting = useSelector(
    form.store,
    (formState) => formState.isSubmitting,
  );
  const submitted = useSelector(
    form.store,
    (formState) => formState.submissionAttempts > 0,
  );
  const purpose = fixed ?? options.purpose;
  const capes = useCapeAccess({ keyRequired: options.method === "mineskin" });
  useIsomorphicLayoutEffect(() => {
    purposeRef.current = purpose;
    capeStatusRef.current = capes.status;
  }, [purpose, capes.status]);
  // Axolotl shows the public capes and Official the checked key's capes.
  // The lists can differ, so a method switch may hide the chosen cape:
  // never send a cape the picker does not show.
  const capeShown =
    options.capeUuid === NO_CAPE_VALUE ||
    capes.supportedCapes.some((cape) => cape.uuid === options.capeUuid);
  useEffect(() => {
    if (!capeShown) form.setFieldValue("capeUuid", NO_CAPE_VALUE);
  }, [form, capeShown]);
  // A fixed purpose or a key check changes which checks apply.
  useEffect(() => {
    void form.validate("change");
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- The validators read `purpose` and the key check through refs.
  }, [form, purpose, capes.status]);

  // Generation: the input is everything the result depends on.
  const normalized = normalizeStudioOptions(options, purpose);
  const input: GenerationInput | null = props.file
    ? {
        purpose,
        file: props.file,
        variant: props.variant,
        method: normalized.method,
        capeUuid: normalized.capeUuid,
        name: normalized.name,
      }
    : null;
  const shown = generation.for(input);
  const nameInvalid =
    studioOptionErrors(options, { purpose, capeStatus: capes.status })
      .customName !== undefined;
  // Any change to the inputs stops waiting for a pending upload.
  /* oxlint-disable react/exhaustive-effect-dependencies -- Each listed input ends the wait for the previous upload. */
  useEffect(
    () => () => {
      generation.cancel();
    },
    [
      generation,
      purpose,
      props.file,
      props.variant,
      normalized.method,
      normalized.capeUuid,
      normalized.apiKey,
      normalized.name,
    ],
  );
  /* oxlint-enable react/exhaustive-effect-dependencies */

  // The options show only for a selected skin, so no hint asks for one.
  const generateHint: MessageKey | undefined = !current
    ? undefined
    : pendingGallery || current.status === "checking"
      ? "studio.openingSkin"
      : current.status === "invalid"
        ? "studio.chooseUsableSkin"
        : nameInvalid
          ? "studio.fixSkinNameFirst"
          : shown.status === "pending"
            ? "studio.uploadingTakesMoment"
            : shown.status === "done"
              ? "studio.changeOptionsNewCommand"
              : undefined;

  // The button submits the native form, so Enter in a field works too.
  // Nothing uploads before this, and a failure is never sent again on its own.
  const submit = async (value: StudioOptions) => {
    const chosen = normalizeStudioOptions(value, purpose);
    if (!input || pendingGallery) return;
    const exact: GenerationInput = { ...input, ...chosen, purpose };
    const fromEditor =
      current?.origin === "handoff" || current?.origin === "editor";
    const route = uploadRoute(chosen);
    const started = performance.now();
    await generation.generate(exact, {
      file: exact.file,
      variant: exact.variant,
      name: exact.name || undefined,
      ...route,
    });
    const outcome = generation.for(exact).status;
    // Measures the upload funnel; "idle" means the visitor stopped waiting.
    void analytics.capture("skin_command_generated", {
      outcome: outcome === "idle" ? "stopped" : outcome,
      command: purpose,
      method: chosen.method,
      cape: route.capeUuid !== undefined,
      page: props.entry,
      duration_ms: Math.round(performance.now() - started),
    });
    if (fromEditor && outcome === "done")
      void analytics.capture("editor_handoff_completed", {
        target: purpose === "createcustom" ? "generator" : "upload",
      });
  };

  useIsomorphicLayoutEffect(() => {
    submitRef.current = submit;
  });

  const chooseCape = (value: string) => {
    if (
      value !== NO_CAPE_VALUE &&
      options.method === "mineskin" &&
      !capes.keyGranted
    ) {
      toast.warning(t("studio.enterVerifyApiKeyBeforeSelectingCape"));
      return;
    }
    form.setFieldValue("capeUuid", value);
  };

  return {
    form,
    fixed,
    purpose,
    options,
    submitting,
    submitted,
    capes,
    /** The chosen cape's image, for the 3D view. */
    capeUrl: capes.supportedCapes.find((cape) => cape.uuid === options.capeUuid)
      ?.url,
    input,
    pendingGallery,
    shown,
    nameInvalid,
    generateHint,
    chooseCape,
    /** "Stop waiting": stop waiting for the pending upload. */
    stopWaiting: () => {
      generation.cancel();
    },
  };
}

export type StudioCommandForm = ReturnType<typeof useStudioCommandForm>;
