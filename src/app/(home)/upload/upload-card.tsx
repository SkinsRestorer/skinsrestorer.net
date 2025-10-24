"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MineSkinApiKeyManager } from "@/components/mineskin-api-key-manager";
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
import { useMineSkin } from "@/lib/hooks/use-mineskin";
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
  const {
    apiKey,
    setApiKey,
    clearApiKey,
    capes,
    loadingCapes,
    capesError,
    hasCapesGrant,
    loadingGrants,
    grantsError,
    refreshGrants,
  } = useMineSkin();
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [selectedCapeUuid, setSelectedCapeUuid] = useState<string | undefined>();

  useEffect(() => {
    if (!hasCapesGrant) {
      setSelectedCapeUuid(undefined);
    }
  }, [hasCapesGrant]);

  useEffect(() => {
    if (
      selectedCapeUuid &&
      !capes.some((cape) => cape.uuid === selectedCapeUuid)
    ) {
      setSelectedCapeUuid(undefined);
    }
  }, [selectedCapeUuid, capes]);

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
        apiKey,
        capeUuid:
          hasCapesGrant && selectedCapeUuid ? selectedCapeUuid : undefined,
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
        error: (error) => `Failed to upload skin: ${error}`,
      },
    );
  }

  const command = resultUrl ? `/skin url "${resultUrl}" ${skinType}` : "";

  const selectedCape = useMemo(
    () =>
      selectedCapeUuid
        ? capes.find((cape) => cape.uuid === selectedCapeUuid)
        : undefined,
    [selectedCapeUuid, capes],
  );

  const capeSelectValue = selectedCapeUuid ?? "none";

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
          <MineSkinApiKeyManager
            apiKey={apiKey}
            onSave={(value) => {
              setApiKey(value);
              refreshGrants();
            }}
            onClear={() => {
              clearApiKey();
              refreshGrants();
            }}
            hasCapesGrant={hasCapesGrant}
            loadingGrants={loadingGrants}
            grantsError={grantsError}
            onRefreshGrants={refreshGrants}
          />
          <div className="space-y-2">
            <Label htmlFor="skin-png-file">Select skin .png file</Label>
            <Input
              id="skin-png-file"
              type="file"
              accept=".png"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                handleFileChange(file);
                setResultUrl(null);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="skin-type">Skin type</Label>
            <Select
              value={skinType}
              onValueChange={(value) => {
                setSkinType(value as SkinVariant);
                setResultUrl(null);
              }}
            >
              <SelectTrigger id="skin-type">
                <SelectValue placeholder="Skin type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">Classic</SelectItem>
                <SelectItem value="slim">Slim</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cape-select">Cape (optional)</Label>
            <Select
              value={capeSelectValue}
              onValueChange={(value) => {
                if (value === "none") {
                  setSelectedCapeUuid(undefined);
                  return;
                }

                if (!hasCapesGrant) {
                  toast.warning("Capes require an API key with the capes grant.");
                  return;
                }

                setSelectedCapeUuid(value);
              }}
            >
              <SelectTrigger id="cape-select">
                <SelectValue
                  placeholder={
                    loadingCapes ? "Loading capes..." : "Select a cape"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No cape</SelectItem>
                {capes.map((cape) => (
                  <SelectItem
                    key={cape.uuid}
                    value={cape.uuid}
                    disabled={!hasCapesGrant}
                  >
                    {cape.alias}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!hasCapesGrant ? (
              <p className="text-xs text-muted-foreground">
                Connect an API key with the capes grant to enable cape selection.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Selected capes will be applied to the preview and upload.
              </p>
            )}
            {capesError && (
              <p className="text-xs text-destructive">
                Failed to load capes: {capesError}
              </p>
            )}
          </div>

          <Button onClick={uploadSkin} disabled={loading} className="w-full">
            Generate /skin url
          </Button>

          {resultUrl && (
            <div className="space-y-2">
              <Label htmlFor="skin-command">Copy this command</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="skin-command"
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
                    } catch (_error) {
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
        capeUrl={hasCapesGrant ? selectedCape?.url : undefined}
      />
    </>
  );
};

