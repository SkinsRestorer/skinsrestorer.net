"use client";

import { useEffect, useId, useState } from "react";
import posthog from "posthog-js";
import { toast } from "sonner";
import {
  AdvancedOptions,
  type UploadMethod,
} from "@/components/advanced-options";
import { CapeField, MineSkinKeyFields } from "@/components/cape-support-fields";
import { ModelSelector } from "@/components/model-selector";
import { OnlineCard } from "@/components/online-card";
import { SkinCard } from "@/components/skin-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SkinPicker } from "@/components/skin-picker/skin-picker";
import {
  NO_CAPE_VALUE,
  useCapeSelection,
} from "@/lib/hooks/use-cape-selection";
import { useEditorHandoff } from "@/lib/hooks/use-editor-handoff";
import { useSkinSelection } from "@/lib/hooks/use-skin-selection";
import { useSkinUpload } from "@/lib/hooks/use-skin-upload";
import {
  sameGenerationInput,
  type GenerationInput,
} from "@/lib/skin-selection";
import { useT } from "@/lib/i18n-react";

export const UploadCard = ({ handoffId }: { handoffId?: string }) => {
  const t = useT();
  const selection = useSkinSelection();
  const { store, state, file: selectedFile } = selection;
  const skinType = state.variant;
  useEditorHandoff(handoffId, (file, variant) =>
    store.select(file, { origin: "handoff", variant }),
  );
  const { loading, cancelUpload, runUpload } = useSkinUpload();
  const [result, setResult] = useState<{
    input: GenerationInput;
    url: string;
  } | null>(null);
  const [target, setTarget] = useState<UploadMethod>("axolotl");
  const useCapeProxy = target === "axolotl";
  const {
    apiKey,
    capeStatus,
    capeOptionsDisabled,
    normalizedApiKey,
    selectedCape,
    selectedCapeUuid,
    supportedCapes,
    handleApiKeyChange,
    handleCapeSelect,
    loadCapeSupport,
  } = useCapeSelection({ autoGrantCapeAccess: useCapeProxy });

  // Any change to the inputs cancels a pending upload and clears the result.
  useEffect(
    () => () => {
      cancelUpload();
      setResult(null);
    },
    [
      cancelUpload,
      selectedFile,
      skinType,
      selectedCapeUuid,
      normalizedApiKey,
      target,
    ],
  );

  const input: GenerationInput | null = selectedFile
    ? {
        file: selectedFile,
        variant: skinType,
        method: target,
        capeUuid: selectedCapeUuid,
        name: "",
      }
    : null;
  const resultUrl =
    result && input && sameGenerationInput(result.input, input)
      ? result.url
      : null;

  function uploadSkin() {
    if (!input) {
      toast.warning(t("Please select a PNG skin file."));
      return;
    }

    const submitted = input;
    const fromEditor = state.selection?.origin === "handoff";
    setResult(null);
    void runUpload(
      {
        file: submitted.file,
        variant: submitted.variant,
        capeUuid:
          selectedCapeUuid === NO_CAPE_VALUE ? undefined : selectedCapeUuid,
        apiKey: normalizedApiKey || undefined,
        useCapeProxy: useCapeProxy && selectedCapeUuid !== NO_CAPE_VALUE,
      },
      {
        loading: t("Uploading skin to MineSkin..."),
        success: t("Skin uploaded successfully."),
        error: (e) =>
          t("Failed to upload skin: {error}", { error: t(String(e)) }),
      },
      (completed) => {
        setResult({
          input: submitted,
          url: completed.skin.url || `https://minesk.in/${completed.skin.uuid}`,
        });
        if (fromEditor)
          posthog.capture("editor_handoff_completed", { target: "upload" });
      },
    );
  }

  const skinCommandId = useId();
  const modelLabelId = useId();
  const command = resultUrl ? `/skin url "${resultUrl}" ${skinType}` : "";

  return (
    <>
      <Card className="group hover:shadow-lg transition-shadow duration-200">
        <CardHeader>
          <CardTitle>{t("Upload Skin")}</CardTitle>
          <CardDescription>
            {t("Upload a PNG skin file and get a copyable")}{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">
              /skin url
            </code>{" "}
            {t("command")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SkinPicker selection={selection} page="Upload" />

          <div className="flex flex-col gap-2">
            <Label id={modelLabelId}>{t("Skin type")}</Label>
            <ModelSelector
              aria-labelledby={modelLabelId}
              value={skinType}
              onValueChange={(value) => store.setVariant(value)}
            />
          </div>

          <CapeField
            capeStatus={capeStatus}
            capeOptionsDisabled={capeOptionsDisabled}
            supportedCapes={supportedCapes}
            selectedCapeUuid={selectedCapeUuid}
            onCapeChange={handleCapeSelect}
            needsApiKey={target === "mineskin"}
          />

          <AdvancedOptions
            method={target}
            onMethodChange={setTarget}
            officialFields={
              <MineSkinKeyFields
                apiKey={apiKey}
                capeStatus={capeStatus}
                onApiKeyChange={handleApiKeyChange}
                onCheckCapeAccess={loadCapeSupport}
              />
            }
          />

          <Button onClick={uploadSkin} disabled={loading} className="w-full">
            {t("Generate /skin url")}
          </Button>

          {resultUrl && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={skinCommandId}>{t("Copy this command")}</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id={skinCommandId}
                  readOnly
                  value={command}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(command);
                      toast.success(t("Copied to clipboard"));
                    } catch (_e) {
                      toast.error(t("Failed to copy"));
                    }
                  }}
                >
                  {t("Copy")}
                </Button>
              </div>
              {!resultUrl.includes("skinsrestorer-axolotl") && (
                <div className="text-xs text-muted-foreground break-all">
                  {t("MineSkin URL:")}{" "}
                  <a
                    className="underline"
                    href={resultUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {resultUrl}
                  </a>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <div className="flex flex-col gap-6">
        <SkinCard
          model={skinType === "slim" ? "slim" : "default"}
          skinUrl={state.previewUrl || undefined}
          capeUrl={selectedCape?.url}
        />
        <OnlineCard />
      </div>
    </>
  );
};
