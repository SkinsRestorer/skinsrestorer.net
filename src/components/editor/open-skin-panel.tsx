"use client";

import { FileImage, Upload } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadTrigger,
} from "@/components/ui/file-upload";
import { Input } from "@/components/ui/input";
import type { SkinVariant } from "@/lib/skin";
import { MAX_SKIN_FILE_BYTES } from "@/lib/skin-document";

export function OpenSkinPanel(props: {
  textureLoading: boolean;
  textureError: string | null;
  onFile: (file: File) => void;
  onTemplate: (variant: SkinVariant) => void;
  onTexture: (reference: string) => void;
}) {
  const textureId = useId();
  const [texture, setTexture] = useState("");
  // A new picker for each file, so the same file can be opened again.
  const [pickerKey, setPickerKey] = useState(0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Open a skin</CardTitle>
        <CardDescription>
          Opening another skin replaces the current one. You can undo it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FileUpload
          key={pickerKey}
          accept=".png,image/png"
          maxFiles={1}
          maxSize={MAX_SKIN_FILE_BYTES}
          onAccept={(files) => {
            setPickerKey((key) => key + 1);
            if (files[0]) props.onFile(files[0]);
          }}
          onFileReject={(_file, message) => toast.error(message)}
          label="Open a skin PNG"
        >
          <FileUploadDropzone>
            <div className="flex flex-col items-center gap-1 text-center">
              <Upload className="text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">Drop a skin PNG here</p>
              <p className="text-xs text-muted-foreground">
                64×64 or legacy 64×32, up to 5 MB
              </p>
            </div>
            <FileUploadTrigger
              render={
                <Button variant="outline" size="sm">
                  <FileImage data-icon="inline-start" />
                  Choose PNG
                </Button>
              }
            />
          </FileUploadDropzone>
        </FileUpload>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => props.onTemplate("classic")}>
            Classic template
          </Button>
          <Button variant="outline" onClick={() => props.onTemplate("slim")}>
            Slim template
          </Button>
        </div>
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            props.onTexture(texture);
          }}
        >
          <Field data-invalid={!!props.textureError || undefined}>
            <FieldLabel htmlFor={textureId}>Texture URL or hash</FieldLabel>
            <div className="flex gap-2">
              <Input
                id={textureId}
                value={texture}
                spellCheck={false}
                autoComplete="off"
                placeholder="https://textures.minecraft.net/texture/…"
                aria-invalid={!!props.textureError || undefined}
                onChange={(event) => setTexture(event.target.value)}
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={!texture.trim() || props.textureLoading}
              >
                {props.textureLoading ? "Opening…" : "Open"}
              </Button>
            </div>
            {props.textureError ? (
              <FieldError>{props.textureError}</FieldError>
            ) : (
              <FieldDescription>
                Your browser downloads the image from textures.minecraft.net.
                For other sites, download the PNG and open it as a file.
              </FieldDescription>
            )}
          </Field>
        </form>
      </CardContent>
    </Card>
  );
}
