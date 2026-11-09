"use client";

import { LocalizedDialogContent as DialogContent } from "@/components/localized-dialog";

import { useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { SaveStatus } from "@/components/save-status";
import { CustomTimeAgo } from "@/components/time-ago";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  LibraryState,
  SkinLibraryActions,
} from "@/lib/hooks/use-skin-library";
import type { StoredSkin } from "@/lib/skin-library";
import { SkinActionsMenu } from "./skin-actions-menu";
import { SkinThumbnail } from "./skin-thumbnail";
import { useLocale, useT } from "@/lib/i18n-react";

const placeholders = ["slot-a", "slot-b", "slot-c"] as const;

const modelLabel = (skin: StoredSkin) =>
  skin.current.variant === "slim" ? "Slim" : "Classic";

/** Every kept skin, with search and the same actions as the picker. */
export function SkinLibraryDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: LibraryState;
  actions: SkinLibraryActions;
  selectedId?: string;
  onSelect: (skin: StoredSkin) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const { state } = props;
  const listing = state.status === "ready" ? state.listing : undefined;
  const drafts = new Set(listing?.sessions.map((session) => session.skinId));
  const needle = query.trim().toLowerCase();
  const skins =
    listing?.skins.filter((skin) => skin.name.toLowerCase().includes(needle)) ??
    [];
  const select = (skin: StoredSkin) => {
    props.onSelect(skin);
    props.onOpenChange(false);
  };
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="flex max-h-[min(40rem,90dvh)] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("Your skins")}</DialogTitle>
          <DialogDescription>
            {t("Stored in this browser only.")}{" "}
            <Link
              to="/{-$lang}/docs/$"
              params={{
                lang: locale === "en" ? undefined : locale,
                _splat: "features/skin-editor",
              }}
              hash="your-skins"
              className="underline underline-offset-4"
            >
              {t("About Your skins")}
            </Link>
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={searchId} className="sr-only">
            {t("Search your skins")}
          </FieldLabel>
          <Input
            id={searchId}
            type="search"
            placeholder={t("Search by name")}
            value={query}
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
        <div className="ph-no-capture -mx-4 min-h-0 flex-1 overflow-y-auto px-4">
          {state.status === "loading" && (
            <ul className="flex flex-col gap-2" aria-busy="true">
              {placeholders.map((slot) => (
                <li key={slot}>
                  <Skeleton className="h-16 w-full" />
                </li>
              ))}
            </ul>
          )}
          {state.status === "unavailable" && (
            <p className="text-sm text-muted-foreground">{t(state.message)}</p>
          )}
          {listing && skins.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {needle ? t("No skins match this name.") : t("No skins yet.")}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {skins.map((skin) => (
              <li
                key={skin.id}
                className="flex items-center gap-3 rounded-lg border p-2 data-[selected=true]:border-foreground"
                data-selected={skin.id === props.selectedId}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  aria-pressed={skin.id === props.selectedId}
                  onClick={() => select(skin)}
                >
                  <span className="flex h-12 w-8 items-center justify-center rounded bg-muted">
                    <SkinThumbnail
                      png={skin.current.png}
                      variant={skin.current.variant}
                      className="h-11 w-[1.375rem]"
                    />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">
                      {skin.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t(modelLabel(skin))}, {skin.current.width}×
                      {skin.current.height}
                      {t(", changed")} <CustomTimeAgo date={skin.updatedAt} />
                    </span>
                  </span>
                </button>
                {drafts.has(skin.id) && (
                  <SaveStatus state="unsaved" label={t("Unsaved edits")} />
                )}
                <SkinActionsMenu
                  skin={skin}
                  name={skin.name}
                  actions={props.actions}
                />
              </li>
            ))}
            {listing?.damaged.map((record) => (
              <li
                key={`${record.store}:${String(record.key)}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-2"
              >
                <span className="text-sm text-muted-foreground">
                  {record.store === "skins"
                    ? t("A damaged skin that cannot be read")
                    : t("A damaged editor draft that cannot be read")}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void props.actions.removeDamaged(record)}
                >
                  {t("Remove")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
