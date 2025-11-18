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
import type { SkinVariant } from "@/lib/skin";

export const UploadCard = () => {
  const {
    file: selectedFile,
    skinUrl,
    skinType,
    setSkinType,
    handleFileChange,
  } = useSkinFile();
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  type SkinUploadTarget = "axolotl" | "mineskin";
  const [target, setTarget] = useState<SkinUploadTarget>("axolotl");
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

  async function uploadSkin() {
    if (!selectedFile) {
      toast.warning("Please select a PNG skin file.");
      return;
    }

    setResultUrl(null);

    toast.promise(
      uploadMineSkinFile({
        file: selectedFile,
        variant: skinType,
        capeUuid:
          selectedCapeUuid === NO_CAPE_VALUE ? undefined : selectedCapeUuid,
        apiKey: normalizedApiKey || undefined,
        useCapeProxy: useCapeProxy && selectedCapeUuid !== NO_CAPE_VALUE,
        callbacks: {
          onStart: () => setLoading(true),
          onComplete: () => setLoading(false),
          onError: () => setLoading(false),
        },
      }).then((completed) => {
        const url =
          completed.skin.url || `https://minesk.in/${completed.skin.uuid}`;

        if (!url) throw new Error("Could not extract skin URL from response");
        setResultUrl(url);
      }),
      {
        loading: "Uploading skin to MineSkin...",
        success: "Skin uploaded successfully.",
        error: (e) => `Failed to upload skin: ${e}`,
      },
    );
  }

  const skinCommandId = useId();
  const command = resultUrl ? `/skin url "${resultUrl}" ${skinType}` : "";

  return (
    <>
      <Card className="group hover:shadow-lg transition-shadow duration-200">
        <CardHeader>
          <CardTitle>Upload Skin</CardTitle>
          <CardDescription>
            Upload a PNG skin file and get a copyable{" "}
            <code className="highlight-code">/skin url</code> command
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
                setResultUrl(null);
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
                setResultUrl(null);
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
                setTarget(value as SkinUploadTarget);
              }}
              className="flex flex-col gap-2"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="axolotl">SkinsRestorer Axolotl</TabsTrigger>
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

          <Button onClick={uploadSkin} disabled={loading} className="w-full">
            Generate /skin url
          </Button>

          {resultUrl && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={skinCommandId}>Copy this command</Label>
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
                      toast.success("Copied to clipboard");
                    } catch (_e) {
                      toast.error("Failed to copy");
                    }
                  }}
                >
                  Copy
                </Button>
              </div>
              {!resultUrl.includes("skinsrestorer-axolotl") && (
                <div className="text-xs text-muted-foreground break-all">
                  MineSkin URL:{" "}
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
          skinUrl={skinUrl || undefined}
          capeUrl={selectedCape?.url}
        />
        <OnlineCard />
      </div>
    </>
  );
};
