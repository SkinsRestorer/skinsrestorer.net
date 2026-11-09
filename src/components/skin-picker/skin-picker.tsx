"use client";

import {
  Check,
  CircleAlert,
  LoaderCircle,
  Pencil,
  Upload,
  X,
} from "lucide-react";
import posthog from "posthog-js";
import { lazy, Suspense, useCallback, useId, useState } from "react";
import type { EditorDialogInitial } from "@/components/editor/skin-editor-dialog";
import { toast } from "sonner";
import { SaveStatus, type SaveState } from "@/components/save-status";
import { Button } from "@/components/ui/button";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadTrigger,
} from "@/components/ui/file-upload";
import { Label } from "@/components/ui/label";
import { useSkinLibrary } from "@/lib/hooks/use-skin-library";
import type { useSkinSelection } from "@/lib/hooks/use-skin-selection";
import type { SaveResult } from "@/lib/editor-session";
import { MAX_SKIN_FILE_BYTES } from "@/lib/skin-document";
import { selectionEditable, type SelectedSkin } from "@/lib/skin-selection";
import type { StoredSkin } from "@/lib/skin-library";
import { SkinActionsMenu } from "./skin-actions-menu";
import { SkinLibraryDialog } from "./skin-library-dialog";
import { SkinThumbnail } from "./skin-thumbnail";

const SkinEditorDialog = lazy(() =>
  import("@/components/editor/skin-editor-dialog").then((module) => ({
    default: module.SkinEditorDialog,
  })),
);

const RECENT_COUNT = 4;

/**
 * The file area of Upload and Generator. Dropping or browsing selects a PNG
 * at once, as before. Skins kept in this browser appear below the drop zone,
 * and the selected skin can be edited without leaving the form.
 */
export function SkinPicker(props: {
  selection: ReturnType<typeof useSkinSelection>;
  /** The page the editor returns to, for its description. */
  page: "Upload" | "Generator";
}) {
  const { store, state } = props.selection;
  const { state: library, actions } = useSkinLibrary();
  const [pickerKey, setPickerKey] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<EditorDialogInitial | null>(null);
  const closeEditor = useCallback(() => setEditing(null), []);
  const headingId = useId();
  const selection = state.selection;
  const listing = library.status === "ready" ? library.listing : undefined;
  const selectedSkin = listing?.skins.find(
    (skin) => skin.id === selection?.skinId,
  );
  const drafts = new Set(listing?.sessions.map((session) => session.skinId));

  const choose = (skin: StoredSkin) => {
    store.selectSkin(skin);
    posthog.capture("skin_library_action", { action: "select" });
  };

  const edited = (result: Extract<SaveResult, { kind: "saved" }>) => {
    if (result.skin) store.selectSkin(result.skin, "editor");
    else
      store.select(result.file, {
        origin: "editor",
        variant: result.variant,
        name: result.name,
      });
  };

  return (
    <div className="flex flex-col gap-2">
      <Label>Select skin .png file</Label>
      <FileUpload
        key={pickerKey}
        accept=".png,image/png"
        multiple
        maxFiles={20}
        maxSize={MAX_SKIN_FILE_BYTES}
        label="Select skin PNG files"
        className="w-full"
        onAccept={(files) => {
          // A new picker each time, so the same file can be chosen again.
          setPickerKey((key) => key + 1);
          store.selectFiles(files);
        }}
        onFileReject={(file, message) => {
          toast(message, {
            description: `"${file.name.length > 20 ? `${file.name.slice(0, 20)}...` : file.name}" has been rejected`,
          });
        }}
      >
        <FileUploadDropzone>
          <div className="flex flex-col items-center gap-1 text-center">
            <div className="flex items-center justify-center rounded-full border p-2.5">
              <Upload className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-sm">Drag & drop skin file here</p>
            <p className="text-muted-foreground text-xs">
              Or click to browse (PNG only, up to 5MB)
            </p>
          </div>
          <FileUploadTrigger
            render={
              <Button variant="outline" size="sm" className="mt-2 w-fit">
                Browse files
              </Button>
            }
          />
        </FileUploadDropzone>
      </FileUpload>

      {selection && (
        <SelectedSkinRow
          selection={selection}
          variant={state.variant}
          skin={selectedSkin}
          actions={actions}
          onEdit={() => {
            setEditing({
              file: selection.file,
              name: selection.name,
              variant: state.variant,
              skinId: selection.skinId,
              revision: selection.revision,
            });
            posthog.capture("skin_edit_opened", { page: props.page });
          }}
          onClear={() => store.clear()}
          onUseLatest={() => store.useLatest()}
          onReverted={(skin) => store.selectSkin(skin)}
        />
      )}

      {listing && listing.skins.length > 0 && (
        <section
          aria-labelledby={headingId}
          className="ph-no-capture mt-2 flex flex-col gap-2"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 id={headingId} className="text-sm font-medium">
              Your skins
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
              Show all
            </Button>
          </div>
          <ul className="grid grid-cols-4 gap-2">
            {listing.skins.slice(0, RECENT_COUNT).map((skin) => {
              const selected = skin.id === selection?.skinId;
              return (
                <li key={skin.id} className="min-w-0">
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={`Use ${skin.name}, ${skin.current.variant} model${drafts.has(skin.id) ? ", has unsaved edits" : ""}`}
                    onClick={() => choose(skin)}
                    className="relative flex w-full min-w-0 flex-col items-center gap-1 rounded-lg border bg-card px-1 pt-2 pb-1.5 text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-foreground aria-pressed:ring-1 aria-pressed:ring-foreground"
                  >
                    <SkinThumbnail
                      png={skin.current.png}
                      variant={skin.current.variant}
                      className="h-11 w-[1.375rem]"
                    />
                    <span className="w-full truncate text-center">
                      {skin.name}
                    </span>
                    {selected && (
                      <span className="absolute top-1 right-1 flex size-3.5 items-center justify-center rounded-sm bg-foreground text-background">
                        <Check className="size-2.5" aria-hidden="true" />
                      </span>
                    )}
                    {drafts.has(skin.id) && (
                      <span
                        aria-hidden="true"
                        className="absolute top-1 left-1 size-2 rounded-full bg-chart-2"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <SkinLibraryDialog
        open={showAll}
        onOpenChange={setShowAll}
        state={library}
        actions={actions}
        selectedId={selection?.skinId}
        onSelect={choose}
      />

      {editing && (
        <Suspense fallback={null}>
          <SkinEditorDialog
            initial={editing}
            onSaved={edited}
            onClose={closeEditor}
          />
        </Suspense>
      )}
    </div>
  );
}

function SelectedSkinRow(props: {
  selection: SelectedSkin;
  variant: "classic" | "slim";
  skin?: StoredSkin;
  actions: ReturnType<typeof useSkinLibrary>["actions"];
  onEdit: () => void;
  onClear: () => void;
  onUseLatest: () => void;
  onReverted: (skin: StoredSkin) => void;
}) {
  const { selection } = props;
  const editable = selectionEditable(selection);
  const size =
    selection.width && selection.height
      ? `${selection.width} × ${selection.height}`
      : "PNG image";
  return (
    <div className="ph-no-capture flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 p-2.5">
      <span className="flex size-10 items-center justify-center rounded-md bg-muted">
        {selection.status === "ready" ? (
          <SkinThumbnail
            png={selection.file}
            variant={props.variant}
            view="head"
            className="size-8"
          />
        ) : selection.status === "checking" ? (
          <LoaderCircle
            className="size-4 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        ) : (
          <CircleAlert className="size-4 text-destructive" aria-hidden="true" />
        )}
      </span>
      <div className="flex min-w-40 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium">{selection.name}</span>
          {selection.status !== "invalid" && (
            <KeepStatus selection={selection} />
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          {selection.status === "invalid"
            ? selection.error
            : `${size}, ${props.variant === "slim" ? "Slim" : "Classic"}`}
        </span>
        {selection.keep.kind === "changed" && (
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            Changed in another tab.
            <Button variant="link" size="sm" onClick={props.onUseLatest}>
              Use the new version
            </Button>
          </span>
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {selection.status === "ready" && (
          <Button
            variant="outline"
            size="sm"
            disabled={!editable}
            title={editable ? undefined : "Only 64×64 and 64×32 skins"}
            onClick={props.onEdit}
          >
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
        )}
        <SkinActionsMenu
          skin={props.skin}
          file={selection.file}
          name={selection.name}
          actions={props.actions}
          onReverted={props.onReverted}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Clear selected skin"
          onClick={props.onClear}
        >
          <X />
        </Button>
      </div>
    </div>
  );
}

/** Whether the selected skin is kept in this browser, as a quiet icon. */
function KeepStatus(props: { selection: SelectedSkin }) {
  const keep = props.selection.keep;
  const [state, label]: [SaveState, string] =
    keep.kind === "saving"
      ? ["saving", "Saving to Your skins"]
      : keep.kind === "off"
        ? ["unavailable", `Not saved. ${keep.message}`]
        : keep.kind === "removed"
          ? ["unavailable", "Removed from Your skins"]
          : keep.kind === "changed"
            ? ["unsaved", "Changed in another tab"]
            : ["saved", "Saved in Your skins"];
  return <SaveStatus state={state} label={label} />;
}
