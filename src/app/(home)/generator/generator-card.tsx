"use client";

import FileSaver from "file-saver";
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

  return (
    <>
      <Card className="group hover:shadow-lg transition-shadow duration-200">
        <CardHeader>
          <CardTitle>Generate Skin File</CardTitle>
          <CardDescription>
            Upload a PNG skin file to generate a custom skin file for
            SkinsRestorer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="skin-png-file">
              Select skin .png file to generate
            </Label>
            <Input
              id="skin-png-file"
              type="file"
              accept=".png"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                handleFileChange(file);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="skin-type">Skin type</Label>
            <Select
              value={skinType}
              onValueChange={(value) => {
                setSkinType(value as SkinVariant);
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
            <Label htmlFor="custom-name">Desired /skin name (optional)</Label>
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

                  const signature = skin.texture.data.signature;
                  const value = skin.texture.data.value;
                  const fileData = {
                    skinName: customName || skin.name || String(skin.uuid),
                    value: value,
                    signature: signature,
                    dataVersion: 1,
                  };

                  const blob = new Blob([JSON.stringify(fileData)], {
                    type: "text/plain;charset=utf-8",
                  });
                  FileSaver.saveAs(blob, `${fileData.skinName}.customskin`);
                }),
                {
                  loading: "Generating skin file...",
                  success: "Skin file generated successfully.",
                  error: (e) => `Failed to generate skin file: ${e}`,
                },
              );
            }}
            disabled={loading}
            className="w-full"
          >
            Generate
          </Button>
        </CardContent>
      </Card>
      <SkinCard
        model={skinType === "slim" ? "slim" : "default"}
        skinUrl={skinUrl || undefined}
      />
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
