"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
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
import { useSkinFile } from "@/lib/hooks/use-skin-file";
import {
  fetchCapeSupport,
  type MineSkinCape,
  uploadMineSkinFile,
} from "@/lib/mineskin";
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
  const [apiKey, setApiKey] = useState("");
  const [capeStatus, setCapeStatus] = useState<
    "idle" | "loading" | "granted" | "denied"
  >("idle");
  const NO_CAPE_VALUE = "__no_cape__";
  const [supportedCapes, setSupportedCapes] = useState<MineSkinCape[]>([]);
  const [selectedCapeUuid, setSelectedCapeUuid] = useState<string | null>(null);

  const normalizedApiKey = apiKey.trim();
  const capeOptionsDisabled =
    capeStatus !== "granted" || supportedCapes.length === 0;
  const selectedCape = useMemo(() => {
    if (!selectedCapeUuid) {
      return undefined;
    }

    return supportedCapes.find((cape) => cape.uuid === selectedCapeUuid);
  }, [selectedCapeUuid, supportedCapes]);

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
        capeUuid: selectedCapeUuid ?? undefined,
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

  const command = resultUrl ? `/skin url "${resultUrl}" ${skinType}` : "";

  async function loadCapeSupport() {
    if (!normalizedApiKey) {
      toast.warning("Enter your MineSkin API key to load capes.");
      return;
    }

    setCapeStatus("loading");
    setSupportedCapes([]);
    setSelectedCapeUuid(null);

    try {
      const { hasCapeGrant, capes } = await fetchCapeSupport(normalizedApiKey);

      if (!hasCapeGrant) {
        setCapeStatus("denied");
        toast.error(
          "Your API key does not have the capes grant. Please check your MineSkin plan.",
        );
        return;
      }

      setCapeStatus("granted");
      setSupportedCapes(capes);

      if (capes.length === 0) {
        toast.info("No supported capes are currently available.");
      } else {
        toast.success("Cape support enabled for this API key.");
      }
    } catch (error) {
      setCapeStatus("idle");
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to verify cape support",
      );
    }
  }

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
            <Label htmlFor="skin-png-file">Select skin .png file</Label>
            <Input
              id="skin-png-file"
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
            <Label htmlFor="skin-type">Skin type</Label>
            <Select
              value={skinType}
              onValueChange={(v) => {
                setSkinType(v as SkinVariant);
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
            <Label htmlFor="mineskin-api-key">MineSkin API key</Label>
            <Input
              id="mineskin-api-key"
              type="password"
              placeholder="Required for cape support"
              value={apiKey}
              onChange={(event) => {
                setApiKey(event.target.value);
                setCapeStatus("idle");
                setSupportedCapes([]);
                setSelectedCapeUuid(null);
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={loadCapeSupport}
              disabled={capeStatus === "loading"}
            >
              {capeStatus === "loading"
                ? "Checking cape support..."
                : "Check cape access"}
            </Button>
            {capeStatus === "denied" && (
              <p className="text-xs text-muted-foreground">
                Cape support requires an API key with the capes grant.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cape-select">Cape (optional)</Label>
            <Select
              value={selectedCapeUuid ?? undefined}
              onValueChange={(value) => {
                if (value === NO_CAPE_VALUE) {
                  setSelectedCapeUuid(null);
                  return;
                }

                if (!normalizedApiKey || capeStatus !== "granted") {
                  toast.warning(
                    "Enter and verify your API key before selecting a cape.",
                  );
                  return;
                }

                setSelectedCapeUuid(value);
              }}
            >
              <SelectTrigger id="cape-select">
                <SelectValue placeholder="No cape" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CAPE_VALUE}>No cape</SelectItem>
                {supportedCapes.map((cape) => (
                  <SelectItem
                    key={cape.uuid}
                    value={cape.uuid}
                    disabled={capeOptionsDisabled}
                  >
                    {cape.alias}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {capeStatus !== "granted" && (
              <p className="text-xs text-muted-foreground">
                Load cape support with a valid API key to preview and apply
                capes.
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
