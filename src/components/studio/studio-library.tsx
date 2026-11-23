"use client";

import {
  Copy,
  Download,
  Ellipsis,
  FileArchive,
  Link2,
  HardDrive,
  Pencil,
  PencilLine,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import {
  type KeyboardEvent,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from "react";
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { moveGridFocus } from "./gallery-keys";
import { SkinThumbnail } from "./skin-thumbnail";

const placeholders = ["slot-a", "slot-b", "slot-c", "slot-d"] as const;

/**
 * Where keyboard focus goes after a change to the list: the skin after a
 * removed one, a new copy, or the empty state. It applies once the listing
 * shows the change.
 */
interface FocusRequest {
  readonly target: string | typeof EMPTY;
  readonly gone?: string;
  readonly appear?: string;
}
const EMPTY = Symbol("empty");

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
  selectedId?: string | undefined;
  commands: LibraryCommands;
  onSelect: (skin: StoredSkin) => void;
  onReverted: (skin: StoredSkin) => void;
  /** Two columns in the phone drawer and on wide screens. */
  layout: "rail" | "drawer";
}) {
  const t = useT();
  const headingId = useId();
  const { state, actions } = props.library;
  const listing = state.status === "ready" ? state.listing : undefined;
  const drafts = new Set(listing?.sessions.map((session) => session.skinId));
  const [renaming, setRenaming] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string>();
  const skins = listing?.skins ?? [];
  // One Tab stop for the whole grid. Arrow keys move between skins.
  const tabStop =
    [focusedId, props.selectedId].find(
      (candidate) => candidate && skins.some((skin) => skin.id === candidate),
    ) ?? skins[0]?.id;
  const section = useRef<HTMLElement>(null);
  const grid = useRef<HTMLUListElement>(null);
  const items = useRef(new Map<string, HTMLButtonElement>());
  const emptyAction = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<FocusRequest | null>(null);
  const shown = useRef(listing);

  /** Move focus once the shown listing has the requested change. */
  const applyFocus = () => {
    const request = pendingFocus.current;
    const showing = shown.current?.skins;
    if (!request || !showing) return;
    const has = (id: string) => showing.some((skin) => skin.id === id);
    if (request.gone && has(request.gone)) return;
    if (request.appear && !has(request.appear)) return;
    pendingFocus.current = null;
    // The menu item or toast that started the change is gone, so focus fell
    // back to the page. Leave focus alone if the user already moved it.
    const active = document.activeElement;
    if (
      active &&
      active !== document.body &&
      !section.current?.contains(active) &&
      !active.closest("[data-sonner-toaster]")
    )
      return;
    // The empty state's buttons show only in the phone drawer. Beside the
    // center panel, which has the same buttons, focus the add menu instead.
    const empty = emptyAction.current;
    const target =
      request.target === EMPTY
        ? empty?.checkVisibility()
          ? empty
          : section.current?.querySelector<HTMLElement>("button")
        : items.current.get(request.target);
    target?.focus();
  };
  const applyShownFocus = useEffectEvent(applyFocus);

  useEffect(() => {
    shown.current = listing;
    applyShownFocus();
  }, [listing]);

  const requestFocus = (request: FocusRequest) => {
    pendingFocus.current = request;
    applyFocus();
  };

  const remove = (id: string) => {
    const index = skins.findIndex((skin) => skin.id === id);
    const next = skins[index + 1] ?? skins[index - 1];
    void actions
      .remove(id, (restored) => {
        requestFocus({ target: restored.id, appear: restored.id });
      })
      .then((removed) => {
        if (removed) requestFocus({ target: next?.id ?? EMPTY, gone: id });
      });
  };

  return (
    <section
      ref={section}
      aria-labelledby={headingId}
      className="flex min-h-0 flex-col gap-2.5"
    >
      <div className="flex items-start gap-1">
        {/* The Library tab shows this name. */}
        <h2 id={headingId} className="sr-only">
          {t("common.library")}
        </h2>
        {state.status === "unavailable" ? (
          // The full reason shows once, below the list.
          <SaveStatus state="unavailable" label={t("library.notSaving")} />
        ) : (
          // A fixed note, not a save state, so it is not announced.
          // It wraps beside the add button instead of being cut off in the
          // narrow column.
          <p className="flex min-w-0 flex-1 items-start gap-1 text-xs text-muted-foreground">
            <HardDrive aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            {t("library.skinsStayBrowserOnly")}
          </p>
        )}
        <span className="ml-auto flex items-center">
          <AddSkinMenu commands={props.commands} />
        </span>
      </div>
      <ul
        ref={grid}
        className={cn(
          "grid gap-2.5 ph-no-capture",
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
              <Skeleton className="h-4 w-3/4" />
            </li>
          ))}
        {listing?.skins.map((skin) => (
          <LibraryItem
            key={skin.id}
            register={(element) => {
              if (element) items.current.set(skin.id, element);
              else items.current.delete(skin.id);
            }}
            skin={skin}
            selected={skin.id === props.selectedId}
            tabStop={skin.id === tabStop}
            onFocus={() => {
              setFocusedId(skin.id);
            }}
            onKeyDown={(event) => {
              moveGridFocus(event, grid.current);
            }}
            draft={drafts.has(skin.id)}
            renaming={renaming === skin.id}
            onRename={() => {
              setRenaming(skin.id);
            }}
            onRenamed={(name) => {
              setRenaming(null);
              if (name && name !== skin.name)
                void actions.rename(skin.id, name);
            }}
            onSelect={() => {
              props.onSelect(skin);
            }}
            onDuplicate={() =>
              void actions.duplicate(skin.id).then((copy) => {
                if (copy) requestFocus({ target: copy.id, appear: copy.id });
              })
            }
            onRevert={() =>
              void actions.revert(skin.id).then((reverted) => {
                if (reverted) props.onReverted(reverted);
              })
            }
            onRemove={() => {
              remove(skin.id);
            }}
          />
        ))}
        {listing?.damaged.map((record) => (
          <li
            key={`${record.store}:${typeof record.key === "object" ? JSON.stringify(record.key) : String(record.key)}`}
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
      {state.status === "unavailable" && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-xs text-muted-foreground">
            {t.message(state.message)}
          </p>
          {state.reload && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                window.location.reload();
              }}
            >
              <RotateCcw data-icon="inline-start" />
              {t("common.reloadPage")}
            </Button>
          )}
        </div>
      )}
      {listing && listing.skins.length === 0 && (
        <div className="flex rounded-lg border border-dashed">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t("library.noSkinsYet")}</EmptyTitle>
              <EmptyDescription>{t("library.noSkinsYetHint")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="sm:hidden">
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  ref={emptyAction}
                  size="sm"
                  onClick={props.commands.upload}
                >
                  <Upload data-icon="inline-start" />
                  {t("library.uploadPng")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={props.commands.create}
                >
                  <Pencil data-icon="inline-start" />
                  {t("common.createSkin")}
                </Button>
              </div>
            </EmptyContent>
          </Empty>
        </div>
      )}
    </section>
  );
}

function LibraryItem(props: {
  /** Receives the select button, so focus can move to this skin. */
  register: (element: HTMLButtonElement | null) => void;
  skin: StoredSkin;
  selected: boolean;
  /** Only one skin in the grid takes Tab focus. */
  tabStop: boolean;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
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
  const button = useRef<HTMLButtonElement>(null);
  const setButton = (element: HTMLButtonElement | null) => {
    button.current = element;
    props.register(element);
  };
  const model = t(
    skin.current.variant === "slim" ? "model.slim" : "model.classic",
  );
  return (
    <li className="group/item relative min-w-0">
      <button
        ref={setButton}
        type="button"
        data-skin-id={skin.id}
        tabIndex={props.tabStop ? 0 : -1}
        onFocus={props.onFocus}
        onKeyDown={props.onKeyDown}
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
            hash={skin.current.hash}
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
            title={skin.name}
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
        <RenameField
          name={skin.name}
          onDone={(name, keyboard) => {
            props.onRenamed(name);
            // The field unmounts: keep keyboard focus on this skin.
            if (keyboard) button.current?.focus();
          }}
        />
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
                // Tab reaches the menu of the skin that has the Tab stop.
                tabIndex={props.tabStop ? 0 : -1}
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
                onClick={() => {
                  downloadSkin(skin.current.png, skin.name);
                }}
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
  /** `keyboard` is true when Enter or Escape ended the rename. */
  onDone: (name: string | null, keyboard: boolean) => void;
}) {
  const t = useT();
  const [value, setValue] = useState(props.name);
  const done = useRef(false);
  const finish = (name: string | null, keyboard = false) => {
    if (done.current) return;
    done.current = true;
    props.onDone(name, keyboard);
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
        onFocus={(event) => {
          event.currentTarget.select();
        }}
        onChange={(event) => {
          setValue(event.target.value);
        }}
        onBlur={() => {
          finish(value.trim() || null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") finish(value.trim() || null, true);
          if (event.key === "Escape") {
            event.stopPropagation();
            finish(null, true);
          }
        }}
      />
    </div>
  );
}
