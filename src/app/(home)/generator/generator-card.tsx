"use client";

import { Upload, X } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { CapeSupportFields } from "@/components/cape-support-fields";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  NO_CAPE_VALUE,
  useCapeSelection,
} from "@/lib/hooks/use-cape-selection";
import { useSkinFile } from "@/lib/hooks/use-skin-file";
import { uploadMineSkinFile } from "@/lib/mineskin";
import { isValidSkinName, type SkinVariant } from "@/lib/skin";
import { ensureHttpsTextureUrl } from "@/lib/textures";

export const GenerateFileCard = () => {
  const {
    file: selectedFile,
    skinUrl,
    skinType,
    setSkinType,
    handleFileChange,
  } = useSkinFile();
  const [customName, setCustomName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    name: string;
    url: string;
    variant: SkinVariant;
  } | null>(null);
  type SkinGenerationTarget = "axolotl" | "mineskin";
  const [target, setTarget] = useState<SkinGenerationTarget>("axolotl");
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
  const customSkinCommandId = useId();
  const command = result
    ? `/sr createcustom ${result.name} "${result.url}" ${result.variant}`
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
              <code className="highlight-code">/sr createcustom</code> command
              for SkinsRestorer
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Select skin .png file</Label>
              <FileUpload
                accept=".png"
                maxFiles={1}
                maxSize={5 * 1024 * 1024}
                className="w-full"
                onValueChange={(files) => {
                  const file = files[0] || null;
                  handleFileChange(file);
                  setResult(null);
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
                      Or click to browse (PNG only, up to 5MB)
                    </p>
                  </div>
                  <FileUploadTrigger asChild>
                    <Button variant="outline" size="sm" className="mt-2 w-fit">
                      Browse files
                    </Button>
                  </FileUploadTrigger>
                </FileUploadDropzone>
                <FileUploadList>
                  {selectedFile && (
                    <FileUploadItem value={selectedFile}>
                      <FileUploadItemPreview />
                      <FileUploadItemMetadata />
                      <FileUploadItemDelete asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <X />
                        </Button>
                      </FileUploadItemDelete>
                    </FileUploadItem>
                  )}
                </FileUploadList>
              </FileUpload>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Skin type</Label>
              <Tabs
                value={skinType}
                onValueChange={(value) => {
                  setSkinType(value as SkinVariant);
                  setResult(null);
                }}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="classic">Classic</TabsTrigger>
                  <TabsTrigger value="slim">Slim</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Upload method</Label>
              <Tabs
                value={target}
                onValueChange={(value) => {
                  setTarget(value as SkinGenerationTarget);
                }}
                className="flex flex-col gap-2"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="axolotl">
                    SkinsRestorer Axolotl
                  </TabsTrigger>
                  <TabsTrigger value="mineskin">MineSkin API</TabsTrigger>
                </TabsList>
                <TabsContent
                  value="axolotl"
                  className="text-xs text-muted-foreground"
                >
                  Use SkinsRestorer Axolotl proxy to upload skins with cape
                  support. This is a free service thanks to a partnership with
                  MineSkin.
                </TabsContent>
                <TabsContent
                  value="mineskin"
                  className="text-xs text-muted-foreground"
                >
                  Provide a MineSkin API key to upload skins directly with the
                  official MineSkin API.
                </TabsContent>
              </Tabs>
            </div>
            <CapeSupportFields
              apiKey={apiKey}
              capeStatus={capeStatus}
              capeOptionsDisabled={capeOptionsDisabled}
              supportedCapes={supportedCapes}
              selectedCapeUuid={selectedCapeUuid}
              onApiKeyChange={handleApiKeyChange}
              onCheckCapeAccess={loadCapeSupport}
              onCapeChange={handleCapeSelect}
              showApiKeyFields={target === "mineskin"}
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
            <Button
              onClick={() => {
                if (!selectedFile) {
                  toast.warning("Please select a file to generate.");
                  return;
                }

                if (customName && !isValidSkinName(customName)) {
                  toast.warning(
                    "Invalid skin name. Skin name can only contain lowercase letters, numbers and underscores. (a-z0-9_)",
                  );
                  return;
                }

                setResult(null);
                const variantForCommand = skinType;
                toast.promise(
                  uploadMineSkinFile({
                    file: selectedFile,
                    variant: skinType,
                    name: customName || undefined,
                    capeUuid:
                      selectedCapeUuid === NO_CAPE_VALUE
                        ? undefined
                        : selectedCapeUuid,
                    apiKey: normalizedApiKey || undefined,
                    useCapeProxy: shouldUseCapeProxy,
                    callbacks: {
                      onStart: () => setLoading(true),
                      onError: () => setLoading(false),
                      onComplete: () => setLoading(false),
                    },
                  }).then((completedJob) => {
                    const skin = completedJob.skin;
                    const skinName =
                      customName ||
                      skin.name ||
                      String(skin.uuid) ||
                      Math.random().toString(36).substring(2, 8);
                    const url = skin.url || `https://minesk.in/${skin.uuid}`;

                    setResult({
                      name: skinName,
                      url,
                      variant: variantForCommand,
                    });
                  }),
                  {
                    loading: "Generating custom skin...",
                    success: "Command ready to copy.",
                    error: (e) => `Failed to generate custom skin: ${e}`,
                  },
                );
              }}
              disabled={loading}
              className="w-full"
            >
              Generate /sr createcustom command
            </Button>
            {result && (
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
                {!result.url.includes("skinsrestorer-axolotl") && (
                  <div className="text-xs text-muted-foreground break-all">
                    MineSkin URL:{" "}
                    <a
                      className="underline"
                      href={result.url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {result.url}
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
          skinUrl={skinUrl || undefined}
          capeUrl={selectedCape?.url}
        />
        <OnlineCard />
      </div>
    </>
  );
};

export const ReverseFileCard = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
              <FileUploadTrigger asChild>
                <Button variant="outline" size="sm" className="mt-2 w-fit">
                  Browse files
                </Button>
              </FileUploadTrigger>
            </FileUploadDropzone>
            <FileUploadList>
              {selectedFile && (
                <FileUploadItem value={selectedFile}>
                  <FileUploadItemPreview />
                  <FileUploadItemMetadata />
                  <FileUploadItemDelete asChild>
                    <Button variant="ghost" size="icon" className="size-7">
                      <X />
                    </Button>
                  </FileUploadItemDelete>
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
      </CardContent>
    </Card>
  );
};
