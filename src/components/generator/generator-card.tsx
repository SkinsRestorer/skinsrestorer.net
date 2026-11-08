"use client";

import { Link } from "@tanstack/react-router";
import { Pencil, Upload, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import posthog from "posthog-js";
import { toast } from "sonner";
import {
  AdvancedOptions,
  type UploadMethod,
} from "@/components/advanced-options";
import { CapeField, MineSkinKeyFields } from "@/components/cape-support-fields";
import { ModelSelector } from "@/components/model-selector";
import { SkinPicker } from "@/components/skin-picker/skin-picker";
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
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadList,
  FileUploadTrigger,
} from "@/components/ui/file-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NO_CAPE_VALUE,
  useCapeSelection,
} from "@/lib/hooks/use-cape-selection";
import { useEditorHandoff } from "@/lib/hooks/use-editor-handoff";
import { useSkinSelection } from "@/lib/hooks/use-skin-selection";
import { useSkinUpload } from "@/lib/hooks/use-skin-upload";
import { isValidSkinName } from "@/lib/skin";
import {
  sameGenerationInput,
  type GenerationInput,
} from "@/lib/skin-selection";
import { parseTextureReference } from "@/lib/skin-texture";
import { ensureHttpsTextureUrl } from "@/lib/textures";

export const GenerateFileCard = ({ handoffId }: { handoffId?: string }) => {
  const selection = useSkinSelection();
  const { store, state, file: selectedFile } = selection;
  const skinType = state.variant;
  useEditorHandoff(handoffId, (file, variant) =>
    store.select(file, { origin: "handoff", variant }),
  );
  const [customName, setCustomName] = useState("");
  const { loading, cancelUpload, runUpload } = useSkinUpload();
  const [result, setResult] = useState<{
    input: GenerationInput;
    name: string;
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

  const customNameId = useId();
  const modelLabelId = useId();
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
      customName,
    ],
  );

  const input: GenerationInput | null = selectedFile
    ? {
        file: selectedFile,
        variant: skinType,
        method: target,
        capeUuid: selectedCapeUuid,
        name: customName,
      }
    : null;
  const shown =
    result && input && sameGenerationInput(result.input, input) ? result : null;

  const customSkinCommandId = useId();
  const command = shown
    ? `/sr createcustom ${shown.name} "${shown.url}" ${shown.input.variant}`
    : "";

  const shouldUseCapeProxy = useCapeProxy && selectedCapeUuid !== NO_CAPE_VALUE;

  return (
    <>
      <div className="lg:col-span-1">
        <Card className="group hover:shadow-lg transition-shadow duration-200">
          <CardHeader>
            <CardTitle>Generate Custom Skin Command</CardTitle>
            <CardDescription>
              Upload a PNG to get a copyable{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">
                /sr createcustom
              </code>{" "}
              command for SkinsRestorer
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <SkinPicker selection={selection} page="Generator" />
            <div className="flex flex-col gap-2">
              <Label id={modelLabelId}>Skin type</Label>
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
            <div className="flex flex-col gap-2">
              <Label htmlFor={customNameId}>
                Desired custom skin name (optional)
              </Label>
              <Input
                id={customNameId}
                type="text"
                placeholder="cool_skin_name"
                value={customName}
                onChange={(e) => {
                  setCustomName(e.target.value);
                }}
              />
            </div>
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
            <Button
              onClick={() => {
                if (!input) {
                  toast.warning("Please select a file to generate.");
                  return;
                }

                if (customName && !isValidSkinName(customName)) {
                  toast.warning(
                    "Invalid skin name. Skin name can only contain lowercase letters, numbers and underscores. (a-z0-9_)",
                  );
                  return;
                }

                const submitted = input;
                const fromEditor = state.selection?.origin === "handoff";
                setResult(null);
                void runUpload(
                  {
                    file: submitted.file,
                    variant: submitted.variant,
                    name: submitted.name || undefined,
                    capeUuid:
                      selectedCapeUuid === NO_CAPE_VALUE
                        ? undefined
                        : selectedCapeUuid,
                    apiKey: normalizedApiKey || undefined,
                    useCapeProxy: shouldUseCapeProxy,
                  },
                  {
                    loading: "Generating custom skin...",
                    success: "Command ready to copy.",
                    error: (e) => `Failed to generate custom skin: ${e}`,
                  },
                  (completedJob) => {
                    const skin = completedJob.skin;
                    setResult({
                      input: submitted,
                      name: submitted.name || skin.name || skin.uuid,
                      url: skin.url || `https://minesk.in/${skin.uuid}`,
                    });
                    if (fromEditor)
                      posthog.capture("editor_handoff_completed", {
                        target: "generator",
                      });
                  },
                );
              }}
              disabled={loading}
              className="w-full"
            >
              Generate /sr createcustom command
            </Button>
            {shown && (
              <div className="flex flex-col gap-2">
                <Label htmlFor={customSkinCommandId}>Copy this command</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id={customSkinCommandId}
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
                        toast.success("Copied to clipboard");
                      } catch (_e) {
                        toast.error("Failed to copy");
                      }
                    }}
                  >
                    Copy
                  </Button>
                </div>
                {!shown.url.includes("skinsrestorer-axolotl") && (
                  <div className="text-xs text-muted-foreground break-all">
                    MineSkin URL:{" "}
                    <a
                      className="underline"
                      href={shown.url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {shown.url}
                    </a>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-1 flex flex-col gap-6">
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

export const ReverseFileCard = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textureHash, setTextureHash] = useState<string | null>(null);

  return (
    <Card className="group hover:shadow-lg transition-shadow duration-200">
      <CardHeader>
        <CardTitle>Reverse Skin File</CardTitle>
        <CardDescription>
          Upload a skin file to extract and view the original skin texture
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Select skin file to reverse</Label>
          <FileUpload
            accept=".playerskin,.urlskin,.customskin,.legacyskin,.skin"
            maxFiles={1}
            maxSize={5 * 1024 * 1024}
            className="w-full"
            onValueChange={(files) => {
              setSelectedFile(files[0] || null);
              setTextureHash(null);
            }}
            onFileReject={(file, message) => {
              toast(message, {
                description: `"${file.name.length > 20 ? `${file.name.slice(0, 20)}...` : file.name}" has been rejected`,
              });
            }}
          >
            <FileUploadDropzone>
              <div className="flex flex-col items-center gap-1 text-center">
                <div className="flex items-center justify-center rounded-full border p-2.5">
                  <Upload className="size-6 text-muted-foreground" />
                </div>
                <p className="font-medium text-sm">
                  Drag & drop skin file here
                </p>
                <p className="text-muted-foreground text-xs">
                  Or click to browse (.playerskin, .urlskin, etc., up to 5MB)
                </p>
              </div>
              <FileUploadTrigger
                render={
                  <Button variant="outline" size="sm" className="mt-2 w-fit">
                    Browse files
                  </Button>
                }
              />
            </FileUploadDropzone>
            <FileUploadList>
              {selectedFile && (
                <FileUploadItem value={selectedFile}>
                  <FileUploadItemPreview />
                  <FileUploadItemMetadata />
                  <FileUploadItemDelete
                    render={
                      <Button variant="ghost" size="icon" className="size-7">
                        <X />
                      </Button>
                    }
                  />
                </FileUploadItem>
              )}
            </FileUploadList>
          </FileUpload>
        </div>
        <Button
          onClick={() => {
            if (!selectedFile) {
              toast.warning("Please select a file to reverse.");
              return;
            }

            toast.promise(
              selectedFile.text().then((text: string) => {
                let rawValue: string;
                try {
                  const textJson = JSON.parse(text);
                  rawValue = textJson.value;
                } catch (_e) {
                  toast.warning("Falling back to legacy skin format.", {
                    description:
                      "Please update SkinsRestorer as soon as possible.",
                  });

                  rawValue = text.split("\n")[0];
                }
                const decodedValue = JSON.parse(window.atob(rawValue));

                const skinUrl = ensureHttpsTextureUrl(
                  decodedValue.textures.SKIN.url,
                );
                if (skinUrl) {
                  setTextureHash(trustedTextureHash(skinUrl));
                  window.open(skinUrl, "_blank", "noopener,noreferrer");
                } else {
                  toast.error("No skin URL found in file");
                }
              }),
              {
                loading: "Reversing skin file...",
                success: "Skin file reversed successfully.",
                error: (e) => `Failed to reverse skin file: ${e}`,
              },
            );
          }}
          className="w-full"
        >
          Reverse
        </Button>
        {textureHash && (
          <Button
            variant="outline"
            className="w-full"
            nativeButton={false}
            render={<Link to="/editor" search={{ texture: textureHash }} />}
          >
            <Pencil data-icon="inline-start" />
            Edit this skin
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

function trustedTextureHash(url: string) {
  try {
    return parseTextureReference(url).hash;
  } catch {
    return null;
  }
}
