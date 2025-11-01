"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { CapeSupportFields } from "@/components/cape-support-fields";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  } = useCapeSelection();

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
        callbacks: {
          onStart: () => setLoading(true),
          onComplete: () => setLoading(false),
          onError: () => setLoading(false),
        },
      }).then((completed) => {
        const url = `https://minesk.in/${completed.skin.uuid}`;

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

  const skinPngFileId = useId();
  const skinTypeId = useId();
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
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={skinPngFileId}>Select skin .png file</Label>
            <Input
              id={skinPngFileId}
              type="file"
              accept=".png"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                handleFileChange(file);
                setResultUrl(null);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={skinTypeId}>Skin type</Label>
            <Select
              value={skinType}
              onValueChange={(v) => {
                setSkinType(v as SkinVariant);
                setResultUrl(null);
              }}
            >
              <SelectTrigger id={skinTypeId}>
                <SelectValue placeholder="Skin type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">Classic</SelectItem>
                <SelectItem value="slim">Slim</SelectItem>
              </SelectContent>
            </Select>
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
          />

          <Button onClick={uploadSkin} disabled={loading} className="w-full">
            Generate /skin url
          </Button>

          {resultUrl && (
            <div className="space-y-2">
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
            </div>
          )}
        </CardContent>
      </Card>
      <SkinCard
        model={skinType === "slim" ? "slim" : "default"}
        skinUrl={skinUrl || undefined}
        capeUrl={selectedCape?.url}
      />
    </>
  );
};
