"use client";

import {
  Copy,
  Download,
  Ellipsis,
  FileArchive,
  Link2,
  Pencil,
  PencilLine,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { useId, useRef, useState } from "react";
import { SaveStatus } from "@/components/save-status";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  downloadSkin,
  skinChanged,
  type useSkinLibrary,
} from "@/lib/hooks/use-skin-library";
import { MAX_SKIN_NAME_LENGTH, type StoredSkin } from "@/lib/skin-library";
import { useT } from "@/lib/i18n-react";
import { cn } from "@/lib/utils";
import { SkinThumbnail } from "./skin-thumbnail";

const placeholders = ["slot-a", "slot-b", "slot-c", "slot-d"] as const;

export interface LibraryCommands {
  readonly upload: () => void;
  readonly create: () => void;
  readonly openSkinFile: () => void;
  readonly openTexture: () => void;
}

/** Add skins: a PNG, a new skin, a storage file, or a texture URL. */
export function AddSkinMenu(props: {
  commands: LibraryCommands;
  disabled?: boolean;
}) {
  const t = useT();
  const { commands } = props;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={props.disabled}
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("library.addSkin")}
          />
        }
      >
        <Plus />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={commands.upload}>
            <Upload />
            {t("library.uploadPng")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={commands.create}>
            <Pencil />
            {t("common.createSkin")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={commands.openSkinFile}>
            <FileArchive />
            {t("library.openSkinFile")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={commands.openTexture}>
            <Link2 />
            {t("common.openTextureUrl")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The skins kept in this browser. One click selects a skin. Each skin has a
 * menu for rename, duplicate, download, revert, and remove.
 */
export function StudioLibrary(props: {
  library: ReturnType<typeof useSkinLibrary>;
  selectedId?: string;
  commands: LibraryCommands;
  onSelect: (skin: StoredSkin) => void;
  onReverted: (skin: StoredSkin) => void;
  /** Two columns in the phone drawer and on wide screens. */
  layout: "rail" | "drawer";
  /** The close button of the phone drawer. */
  closeButton?: React.ReactNode;
  hideHeading?: boolean;
}) {
  const t = useT();
  const headingId = useId();
  const { state, actions } = props.library;
  const listing = state.status === "ready" ? state.listing : undefined;
  const drafts = new Set(listing?.sessions.map((session) => session.skinId));
  const [renaming, setRenaming] = useState<string | null>(null);

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-h-0 flex-col gap-2.5"
    >
      <div className="flex flex-wrap items-center gap-1">
        <h2
          id={headingId}
          className={cn(
            "text-sm font-semibold",
            props.hideHeading && "sr-only",
          )}
        >
          {t("common.library")}
        </h2>
        {state.status === "unavailable" ? (
          <SaveStatus
            state="unavailable"
            label={t("studio.notSavedError", {
              error: t.message(state.message),
            })}
          />
        ) : (
          <SaveStatus
            state="saved"
            className="text-muted-foreground"
            label={t("library.skinsStayBrowserOnly")}
          />
        )}
        <span className="ml-auto flex items-center">
          <AddSkinMenu commands={props.commands} />
          {props.closeButton}
        </span>
      </div>
      <ul
        className={cn(
          "ph-no-capture grid gap-2.5",
          props.layout === "drawer"
            ? "grid-cols-2"
            : "grid-cols-1 lg:grid-cols-2",
        )}
        aria-busy={state.status === "loading" || undefined}
      >
        {state.status === "loading" &&
          placeholders.map((slot) => (
            <li key={slot} className="flex flex-col gap-1.5">
              <Skeleton className="aspect-square w-full" />
              <Skeleton className="h-3 w-3/4" />
            </li>
          ))}
        {listing?.skins.map((skin) => (
          <LibraryItem
            key={skin.id}
            skin={skin}
            selected={skin.id === props.selectedId}
            draft={drafts.has(skin.id)}
            renaming={renaming === skin.id}
            onRename={() => setRenaming(skin.id)}
            onRenamed={(name) => {
              setRenaming(null);
              if (name && name !== skin.name)
                void actions.rename(skin.id, name);
            }}
            onSelect={() => props.onSelect(skin)}
            onDuplicate={() => void actions.duplicate(skin.id)}
            onRevert={() =>
              void actions.revert(skin.id).then((reverted) => {
                if (reverted) props.onReverted(reverted);
              })
            }
            onRemove={() => void actions.remove(skin.id)}
          />
        ))}
        {listing?.damaged.map((record) => (
          <li
            key={`${record.store}:${String(record.key)}`}
            className="col-span-full flex flex-col gap-1.5 rounded-lg border border-dashed p-2 text-xs text-muted-foreground"
          >
            {record.store === "skins"
              ? t("library.damagedSkinCannotRead")
              : t("library.damagedEditorDraftCannotRead")}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void actions.removeDamaged(record)}
            >
              {t("common.remove")}
            </Button>
          </li>
        ))}
      </ul>
      {listing && listing.skins.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {t("library.noSkinsYet")}
        </p>
      )}
    </section>
  );
}

function LibraryItem(props: {
  skin: StoredSkin;
  selected: boolean;
  draft: boolean;
  renaming: boolean;
  onSelect: () => void;
  onRename: () => void;
  onRenamed: (name: string | null) => void;
  onDuplicate: () => void;
  onRevert: () => void;
  onRemove: () => void;
}) {
  const t = useT();
  const { skin } = props;
  const model = t(
    skin.current.variant === "slim" ? "model.slim" : "model.classic",
  );
  return (
    <li className="group/item relative min-w-0">
      <button
        type="button"
        aria-current={props.selected || undefined}
        aria-label={t(
          props.draft
            ? "library.nameModelModelHasUnsavedEdits"
            : "gallery.nameModelModel",
          { name: skin.name, model },
        )}
        onClick={props.onSelect}
        className="flex w-full min-w-0 flex-col gap-1.5 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          className={cn(
            "relative grid aspect-square w-full place-items-center rounded-lg border bg-muted transition-colors",
            props.selected
              ? "border-foreground"
              : "border-transparent group-hover/item:border-foreground/35",
          )}
        >
          <SkinThumbnail
            png={skin.current.png}
            variant={skin.current.variant}
            view="bust"
            className="w-[64%]"
          />
          {props.draft && (
            <span
              aria-hidden="true"
              className="absolute top-1.5 left-1.5 size-2 rounded-full bg-chart-2"
            />
          )}
        </span>
        {!props.renaming && (
          <span
            className={cn(
              "truncate text-xs",
              props.selected
                ? "font-medium text-foreground"
                : "text-muted-foreground",
            )}
          >
            {skin.name}
          </span>
        )}
      </button>
      {props.renaming && (
        <RenameField name={skin.name} onDone={props.onRenamed} />
      )}
      <span
        className={cn(
          "absolute top-1 right-1 rounded-md bg-card/80 opacity-0 group-focus-within/item:opacity-100 group-hover/item:opacity-100 has-data-popup-open:opacity-100 pointer-coarse:opacity-100",
          props.selected && "opacity-100",
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("library.moreActionsName", { name: skin.name })}
                className="size-7"
              />
            }
          >
            <Ellipsis />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={props.onRename}>
                <PencilLine />
                {t("library.rename")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={props.onDuplicate}>
                <Copy />
                {t("library.duplicate")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => downloadSkin(skin.current.png, skin.name)}
              >
                <Download />
                {t("common.downloadPng")}
              </DropdownMenuItem>
              {skinChanged(skin) && (
                <DropdownMenuItem onClick={props.onRevert}>
                  <RotateCcw />
                  {t("library.revertOriginal")}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem variant="destructive" onClick={props.onRemove}>
                <Trash2 />
                {t("common.remove")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </li>
  );
}

/** Rename in place. Enter or leaving the field saves; Escape cancels. */
function RenameField(props: {
  name: string;
  onDone: (name: string | null) => void;
}) {
  const t = useT();
  const [value, setValue] = useState(props.name);
  const done = useRef(false);
  const finish = (name: string | null) => {
    if (done.current) return;
    done.current = true;
    props.onDone(name);
  };
  return (
    <div className="mt-1.5">
      <Input
        aria-label={t("library.name")}
        value={value}
        maxLength={MAX_SKIN_NAME_LENGTH}
        autoComplete="off"
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- the user asked to rename this item.
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => finish(value.trim() || null)}
        onKeyDown={(event) => {
          if (event.key === "Enter") finish(value.trim() || null);
          if (event.key === "Escape") {
            event.stopPropagation();
            finish(null);
          }
        }}
      />
    </div>
  );
}
