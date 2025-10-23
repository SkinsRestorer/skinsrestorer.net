"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SkinCard } from "~/components/skin-card";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useSkinFile } from "~/lib/hooks/use-skin-file";
import { uploadMineSkinFile } from "~/lib/mineskin";
import { isValidSkinName, type SkinVariant } from "~/lib/skin";

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

  const command = result
    ? `/sr createcustom ${result.name} "${result.url}" ${result.variant}`
    : "";

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
              <Label htmlFor="skin-png-file">Select skin .png file</Label>
              <Input
                id="skin-png-file"
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
              <Label htmlFor="skin-type">Skin type</Label>
              <Select
                value={skinType}
                onValueChange={(value) => {
                  setSkinType(value as SkinVariant);
                  setResult(null);
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
              <Label htmlFor="custom-name">
                Desired custom skin name (optional)
              </Label>
              <Input
                id="custom-name"
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
                <Label htmlFor="custom-skin-command">Copy this command</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="custom-skin-command"
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
          animationType="walking"
        />
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
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="skin-file">Select skin file to reverse</Label>
          <Input
            id="skin-file"
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

                const skinUrl = decodedValue.textures.SKIN.url;
                window.open(skinUrl);
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
