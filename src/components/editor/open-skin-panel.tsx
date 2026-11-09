"use client";

import { FileImage, Upload } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { SkinLibraryDialog } from "@/components/skin-picker/skin-library-dialog";
import { SkinThumbnail } from "@/components/skin-picker/skin-thumbnail";
import type { useSkinLibrary } from "@/lib/hooks/use-skin-library";
import type { SkinVariant } from "@/lib/skin";
import type { StoredSkin } from "@/lib/skin-library";
import { MAX_SKIN_FILE_BYTES } from "@/lib/skin-document";
import { useT } from "@/lib/i18n-react";

export function OpenSkinPanel(props: {
  textureLoading: boolean;
  textureError: string | null;
  library: ReturnType<typeof useSkinLibrary>;
  currentSkinId?: string;
  onFile: (file: File) => void;
  onSaved: (skin: StoredSkin) => void;
  onTemplate: (variant: SkinVariant) => void;
  onTexture: (reference: string) => void;
}) {
  const t = useT();
  const textureId = useId();
  const [texture, setTexture] = useState("");
  // A new picker for each file, so the same file can be opened again.
  const [pickerKey, setPickerKey] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const libraryState = props.library.state;
  const skins =
    libraryState.status === "ready" ? libraryState.listing.skins : [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("Open a skin")}</CardTitle>
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
          onFileReject={(_file, message) => toast.error(t(message))}
          label={t("Open a skin PNG")}
        >
          <FileUploadDropzone>
            <div className="flex flex-col items-center gap-1 text-center">
              <Upload className="text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">{t("Drop a skin PNG here")}</p>
              <p className="text-xs text-muted-foreground">
                {t("64×64 or legacy 64×32, up to 5 MB")}
              </p>
            </div>
            <FileUploadTrigger
              render={
                <Button variant="outline" size="sm">
                  <FileImage data-icon="inline-start" />
                  {t("Choose PNG")}
                </Button>
              }
            />
          </FileUploadDropzone>
        </FileUpload>
        {skins.length > 0 && (
          <section
            className="ph-no-capture flex flex-col gap-2"
            aria-label={t("Your skins")}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{t("Your skins")}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAll(true)}
              >
                {t("Show all")}
              </Button>
            </div>
            <ul className="grid grid-cols-4 gap-2">
              {skins.slice(0, 4).map((skin) => (
                <li key={skin.id} className="min-w-0">
                  <button
                    type="button"
                    aria-pressed={skin.id === props.currentSkinId}
                    aria-label={t("Open {name}", { name: skin.name })}
                    onClick={() => props.onSaved(skin)}
                    className="flex w-full min-w-0 flex-col items-center gap-1 rounded-lg border bg-card px-1 pt-2 pb-1.5 text-xs outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-foreground"
                  >
                    <SkinThumbnail
                      png={skin.current.png}
                      variant={skin.current.variant}
                      className="h-11 w-[1.375rem]"
                    />
                    <span className="w-full truncate text-center">
                      {skin.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <SkinLibraryDialog
          open={showAll}
          onOpenChange={setShowAll}
          state={libraryState}
          actions={props.library.actions}
          selectedId={props.currentSkinId}
          onSelect={props.onSaved}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => props.onTemplate("classic")}>
            {t("Classic template")}
          </Button>
          <Button variant="outline" onClick={() => props.onTemplate("slim")}>
            {t("Slim template")}
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
            <FieldLabel htmlFor={textureId}>
              {t("Texture URL or hash")}
            </FieldLabel>
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
                {props.textureLoading ? t("Opening…") : t("Open")}
              </Button>
            </div>
            {props.textureError ? (
              <FieldError>{t(props.textureError)}</FieldError>
            ) : (
              <FieldDescription>
                {t("From textures.minecraft.net only.")}
              </FieldDescription>
            )}
          </Field>
        </form>
      </CardContent>
    </Card>
  );
}
