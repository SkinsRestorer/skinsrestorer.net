"use client";

import {
  Check,
  Download,
  FolderPlus,
  Link2,
  Pencil,
  TriangleAlert,
} from "lucide-react";
import { lazy, Suspense, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { SaveStatus, type SaveState } from "@/components/save-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadSkin } from "@/lib/hooks/use-skin-library";
import { useT } from "@/lib/i18n-react";
import { selectionEditable, type SelectedSkin } from "@/lib/skin-selection";
import { loadSkinView } from "./load-skin-view";
import { SkinThumbnail } from "./skin-thumbnail";

const SkinView = lazy(() =>
  loadSkinView().then((module) => ({ default: module.SkinView })),
);

export function SelectedSkinView(props: {
  selection: SelectedSkin;
  variant: "classic" | "slim";
  previewUrl: string | null;
  capeUrl?: string | undefined;
  onEdit: () => void;
  onUseLatest: () => void;
  onKeep?: (() => void) | undefined;
  /** The browser cannot keep skins, so Download is the only way to keep one. */
  storageBlocked?: boolean;
  galleryLink?: string | undefined;
  /** Element ids, so the Studio can move focus here after a view change. */
  headingId?: string;
  editButtonId?: string;
  keepButtonId?: string;
}) {
  const t = useT();
  const { selection, galleryLink } = props;
  const editable = selectionEditable(selection);
  const editHintId = useId();
  const editHint =
    selection.status === "ready" && !editable
      ? t("studio.only64646432Skins")
      : undefined;
  // Library skins have Download in their menu. Offer it here for skins the
  // library does not hold.
  const downloadable =
    selection.status !== "invalid" &&
    (galleryLink !== undefined ||
      props.storageBlocked ||
      selection.keep.kind === "off" ||
      selection.keep.kind === "removed");
  const [copied, setCopied] = useState(false);
  useEffect((): (() => void) | undefined => {
    if (!copied) return undefined;
    const timer = setTimeout(() => {
      setCopied(false);
    }, 1400);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);
  return (
    <>
      <div className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 ph-no-capture">
        <h2
          id={props.headingId}
          tabIndex={-1}
          className="min-w-0 truncate text-base font-semibold outline-none"
        >
          {selection.name}
        </h2>
        {selection.status !== "invalid" &&
          selection.keep.kind !== "catalog" && (
            <KeepStatus selection={selection} />
          )}
        {selection.keep.kind === "changed" && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {t("studio.changedSkinNotice")}
            <Button variant="link" size="sm" onClick={props.onUseLatest}>
              {t("studio.useNewVersion")}
            </Button>
          </span>
        )}
      </div>
      {selection.status === "invalid" ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>{t("studio.fileCannotUsed")}</AlertTitle>
          <AlertDescription>
            {t.message(selection.error ?? "")}
          </AlertDescription>
        </Alert>
      ) : (
        <Suspense fallback={<Skeleton className="h-[300px] sm:h-[360px]" />}>
          <SkinView
            skinUrl={props.previewUrl}
            capeUrl={props.capeUrl}
            variant={props.variant}
            label={t("studio.name3dViewDragUseArrowKeys", {
              name: selection.name,
            })}
            fallback={
              selection.status === "ready" && (
                <SkinThumbnail
                  png={selection.file}
                  variant={props.variant}
                  className="h-40 w-20"
                />
              )
            }
          />
        </Suspense>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          id={props.editButtonId}
          variant="outline"
          disabled={!editable}
          focusableWhenDisabled
          title={editHint}
          aria-describedby={editHint ? editHintId : undefined}
          onClick={props.onEdit}
        >
          <Pencil data-icon="inline-start" />
          {t("studio.editSkin")}
        </Button>
        {editHint && (
          <span id={editHintId} className="sr-only">
            {editHint}
          </span>
        )}
        {props.onKeep && (
          <Button
            id={props.keepButtonId}
            size="icon"
            variant="ghost"
            disabled={selection.status !== "ready"}
            aria-label={t("common.saveLibrary")}
            title={t("common.saveLibrary")}
            onClick={props.onKeep}
          >
            <FolderPlus />
          </Button>
        )}
        {galleryLink && (
          <Button
            size="icon"
            variant="ghost"
            aria-label={t("common.copyGalleryLink")}
            title={t("common.copyGalleryLink")}
            onClick={() =>
              void navigator.clipboard
                .writeText(new URL(galleryLink, window.location.origin).href)
                .then(
                  () => {
                    setCopied(true);
                    // The icon change alone is easy to miss.
                    toast.success(t("common.copiedClipboard"));
                  },
                  () => toast.error(t("common.failedCopy")),
                )
            }
          >
            {copied ? <Check /> : <Link2 />}
          </Button>
        )}
        {downloadable && (
          <Button
            size="icon"
            variant="ghost"
            disabled={selection.status !== "ready"}
            aria-label={t("common.downloadPng")}
            title={t("common.downloadPng")}
            onClick={() => {
              downloadSkin(selection.file, selection.name);
            }}
          >
            <Download />
          </Button>
        )}
      </div>
    </>
  );
}

/** Whether the selected skin is kept in this browser, as a quiet icon. */
function KeepStatus(props: { selection: SelectedSkin }) {
  const t = useT();
  const keep = props.selection.keep;
  const [state, label]: [SaveState, string] =
    keep.kind === "saving"
      ? ["saving", t("studio.savingLibrary")]
      : keep.kind === "off"
        ? [
            "unavailable",
            t("studio.notSavedError", { error: t.message(keep.message) }),
          ]
        : keep.kind === "removed"
          ? ["unavailable", t("studio.removedLibrary")]
          : keep.kind === "changed"
            ? ["unsaved", t("studio.changedAnotherTab")]
            : ["saved", t("studio.savedLibrary")];
  return <SaveStatus state={state} label={label} />;
}
