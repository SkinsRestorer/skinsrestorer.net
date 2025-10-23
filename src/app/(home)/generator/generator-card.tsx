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
import {
  getMineSkinErrorMessage,
  MINESKIN_USER_AGENT,
  type MineSkinEnqueueResponse,
  pollMineSkinJob,
} from "~/lib/mineskin";

// OnlineCard moved to ~/components/online-card and is used directly by pages

export const GenerateFileCard = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [skinUrl, setSkinUrl] = useState<string | null>(null);
  const [skinType, setSkinType] = useState("classic");
  const [customName, setCustomName] = useState("");
  const [loading, setLoading] = useState(false);

  async function skinChecker(skinURL: string) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "Anonymous";
      image.src = skinURL;

      image.onload = () => {
        const detectCanvas = document.createElement("canvas");
        const detectCtx = detectCanvas.getContext("2d");
        if (!detectCtx) return reject("Failed to get canvas context.");
        detectCanvas.width = image.width;
        detectCanvas.height = image.height;
        detectCtx.drawImage(image, 0, 0);
        const px1 = detectCtx.getImageData(46, 52, 1, 12).data;
        const px2 = detectCtx.getImageData(54, 20, 1, 12).data;
        let allTransparent = true;
        for (let i = 3; i < 12 * 4; i += 4) {
          if (px1[i] === 255 || px2[i] === 255) {
            allTransparent = false;
            break;
          }
        }

        resolve(allTransparent);
      };

      image.onerror = () => {
        reject("Failed to load image.");
      };
    });
  }

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
                setSelectedFile(file);
                if (file) {
                  setSkinUrl(URL.createObjectURL(file));
                  toast.promise(
                    skinChecker(URL.createObjectURL(file)).then((slim) => {
                      setSkinType(slim ? "slim" : "classic");
                      return slim ? "slim" : "classic";
                    }),
                    {
                      loading: "Detecting skin type...",
                      success: (v) => `Skin file detected as a ${v} skin.`,
                      error: (e) => `Failed to detect skin type: ${e}`,
                    },
                  );
                } else {
                  setSkinUrl(null);
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="skin-type">Skin type</Label>
            <Select
              value={skinType}
              onValueChange={(value) => {
                setSkinType(value);
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

              if (customName && !/^[a-z0-9_]+$/.test(customName)) {
                toast.warning(
                  "Invalid skin name. Skin name can only contain lowercase letters, numbers and underscores. (a-z0-9_)",
                );
                return;
              }

              const formData = new FormData();
              formData.append("file", selectedFile);
              formData.append("variant", skinType);
              if (customName) {
                formData.append("name", customName);
              }

              setLoading(true);
              toast.promise(
                fetch("https://api.mineskin.org/v2/queue", {
                  method: "POST",
                  headers: {
                    "User-Agent": MINESKIN_USER_AGENT,
                  },
                  body: formData,
                })
                  .then((response) => response.json())
                  .then(async (rawResponse) => {
                    const response = rawResponse as MineSkinEnqueueResponse;

                    if (!response.success) {
                      throw new Error(getMineSkinErrorMessage(response.errors));
                    }

                    const jobId = response.job.id;
                    const completedJob = await pollMineSkinJob(jobId);
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
                  finally: () => setLoading(false),
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
