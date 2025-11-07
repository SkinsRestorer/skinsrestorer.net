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
  const [useCapeProxy, setUseCapeProxy] = useState(false);
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

  const skinPngFileId = useId();
  const skinTypeId = useId();
  const customNameId = useId();
  const customSkinCommandId = useId();
  const capeProxyToggleId = useId();

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
                  setResult(null);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={skinTypeId}>Skin type</Label>
              <Select
                value={skinType}
                onValueChange={(value) => {
                  setSkinType(value as SkinVariant);
                  setResult(null);
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
              showApiKeyFields={!useCapeProxy}
            />
            <div className="space-y-2">
              <Label
                htmlFor={capeProxyToggleId}
                className="flex items-center gap-2 text-sm font-medium"
              >
                <input
                  id={capeProxyToggleId}
                  type="checkbox"
                  className="h-4 w-4"
                  checked={useCapeProxy}
                  onChange={(event) => {
                    setUseCapeProxy(event.target.checked);
                  }}
                />
                Use Axolotl cape proxy
              </Label>
              <p className="text-xs text-muted-foreground">
                Automatically use the cape-enabled proxy when a cape is
                selected. Requests without a cape still go through the official
                MineSkin API.
              </p>
            </div>
            <div className="space-y-2">
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
                      customName || skin.name || String(skin.uuid);
                    const url = `https://minesk.in/${skin.uuid}`;

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
              <div className="space-y-2">
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-1">
        <SkinCard
          model={skinType === "slim" ? "slim" : "default"}
          skinUrl={skinUrl || undefined}
          capeUrl={selectedCape?.url}
        />
      </div>
    </>
  );
};

export const ReverseFileCard = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const skinFileId = useId();

  return (
    <Card className="group hover:shadow-lg transition-shadow duration-200">
      <CardHeader>
        <CardTitle>Reverse Skin File</CardTitle>
        <CardDescription>
          Upload a skin file to extract and view the original skin texture
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={skinFileId}>Select skin file to reverse</Label>
          <Input
            id={skinFileId}
            type="file"
            accept=".playerskin,.urlskin,.customskin,.legacyskin,.skin"
            onChange={(e) => {
              setSelectedFile(e.target.files?.[0] || null);
            }}
          />
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
