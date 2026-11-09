"use client";

import { errorMessage, message, type Message } from "@/lib/messages";

import posthog from "posthog-js";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { browserStorage } from "../skin-draft";
import {
  browserLibrary,
  migrateLegacyDraft,
  withLibrary,
  type LibraryClient,
  type MigrationResult,
} from "../skin-library-client";
import type {
  DamagedRecord,
  LibraryListing,
  StoredSkin,
} from "../skin-library";
import { useLatestTask } from "./use-latest-task";
import { useNotificationT } from "@/lib/i18n-react";

export type LibraryState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly listing: LibraryListing }
  | { readonly status: "unavailable"; readonly message: Message };

let migration: Promise<MigrationResult> | undefined;

/** Move the old editor draft into the library once per page load. */
function migrateOnce(client: LibraryClient) {
  migration ??= migrateLegacyDraft(
    client,
    browserStorage("localStorage"),
  ).catch((): MigrationResult => ({ status: "unavailable" }));
  return migration;
}

export function skinChanged(skin: StoredSkin) {
  return (
    skin.current.hash !== skin.original.hash ||
    skin.current.variant !== skin.original.variant
  );
}

export function downloadSkin(png: Blob, name: string) {
  const url = URL.createObjectURL(png);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  posthog.capture("skin_library_action", { action: "download" });
}

/**
 * The skins kept in this browser. Reads refresh after every change in this
 * or another tab; a superseded read never replaces a newer one.
 */
export function useSkinLibrary() {
  const t = useNotificationT();
  const [client, setClient] = useState<LibraryClient | undefined>();
  const [state, setState] = useState<LibraryState>({ status: "loading" });
  const [migrated, setMigrated] = useState<MigrationResult | undefined>();
  const task = useLatestTask();

  useEffect(() => setClient(browserLibrary()), []);

  const reload = useCallback(() => {
    if (!client) return;
    void task.run(
      (signal) =>
        client.run(
          withLibrary((l) => l.list),
          signal,
        ),
      (listing) => setState({ status: "ready", listing }),
      (cause) =>
        setState({ status: "unavailable", message: errorMessage(cause) }),
    );
  }, [client, task]);

  useEffect(() => {
    if (!client) return;
    let active = true;
    void migrateOnce(client).then((result) => {
      if (!active) return;
      setMigrated(result);
      reload();
    });
    const stop = client.subscribe((event) => {
      if (event.type === "closed")
        setState({
          status: "unavailable",
          message: message("library.anotherTabUpdatedSkinsReloadPage"),
        });
      else reload();
    });
    return () => {
      active = false;
      stop();
    };
  }, [client, reload, t]);

  const act = useCallback(
    async <A>(
      action: string,
      run: (client: LibraryClient) => Promise<A>,
    ): Promise<A | undefined> => {
      if (!client) return undefined;
      try {
        const result = await run(client);
        posthog.capture("skin_library_action", { action });
        return result;
      } catch (cause) {
        toast.error(t.error(cause));
        return undefined;
      }
    },
    [client, t],
  );

  const actions = {
    rename: (id: string, name: string) =>
      act("rename", (c) => c.run(withLibrary((l) => l.rename(id, name)))),
    duplicate: (id: string) =>
      act("duplicate", (c) => c.run(withLibrary((l) => l.duplicate(id)))),
    remove: (id: string) =>
      act("remove", (c) => c.run(withLibrary((l) => l.remove(id)))).then(
        (removed) => {
          if (!removed) return;
          toast(t("library.skinRemoved"), {
            action: {
              label: t("common.undo"),
              onClick: () =>
                void act("restore", (c) =>
                  c.run(withLibrary((l) => l.restore(removed))),
                ),
            },
          });
        },
      ),
    revert: (id: string) =>
      act("revert", (c) => c.run(withLibrary((l) => l.revert(id)))).then(
        (reverted) => {
          if (!reverted) return;
          toast(t("library.skinReverted"), {
            action: {
              label: t("common.undo"),
              onClick: () =>
                void act("undo_revert", (c) =>
                  c.run(
                    withLibrary((l) => l.setContent(id, reverted.previous)),
                  ),
                ),
            },
          });
          return reverted.skin;
        },
      ),
    removeDamaged: (record: DamagedRecord) =>
      act("remove_damaged", (c) =>
        c.run(withLibrary((l) => l.removeDamaged(record))),
      ),
  };

  return { client, state, migrated, actions };
}

export type SkinLibraryActions = ReturnType<typeof useSkinLibrary>["actions"];
