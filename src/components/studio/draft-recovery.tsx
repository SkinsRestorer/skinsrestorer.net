import { analytics } from "@/lib/analytics";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { CustomTimeAgo } from "@/components/time-ago";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import type { EditorSession } from "@/lib/editor-session";
import type { LibraryState } from "@/lib/hooks/use-skin-library";
import type { LibraryClient } from "@/lib/skin-library-client";
import { useNotificationT, useT } from "@/lib/i18n-react";
import type { EditSession, StoredSkin } from "@/lib/skin-library";

/**
 * Drafts from earlier visits or closed tabs, offered while the Studio shows
 * the view. The list follows every library change, for example a removed
 * skin that took its drafts along, and every draft write in other tabs.
 */
export function DraftRecovery(props: {
  session: EditorSession;
  library: LibraryClient | undefined;
  /** The skin list; each new listing reads the drafts again. */
  libraryState: LibraryState;
  onContinue: () => void;
  /** A draft became a new skin; the Studio selects it. */
  onSavedSkin: (skin: StoredSkin) => void;
}) {
  const t = useT();
  const notify = useNotificationT();
  const { session } = props;
  const work = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  /** The draft with an action in progress. Its buttons wait for it. */
  const [pending, setPending] = useState<string>();
  const { libraryState } = props;
  useEffect(() => {
    if (libraryState.status === "loading") return;
    void session.loadRecovery();
  }, [session, libraryState]);
  // Draft writes do not change the skin list, so they come as their own
  // event. Only this list follows them.
  useEffect(
    () =>
      props.library?.subscribe((event) => {
        if (event.type === "sessions") void session.loadRecovery();
      }),
    [session, props.library],
  );
  if (work.recoveryError !== undefined && work.recovery.length === 0)
    return (
      <Alert variant="destructive">
        <AlertTitle>{t("studio.draftsCouldNotLoad")}</AlertTitle>
        <AlertDescription>
          {t.message(work.recoveryError)}
          <Button
            size="sm"
            variant="outline"
            className="mt-1"
            onClick={() => void session.loadRecovery()}
          >
            {t("common.tryAgain")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (work.recovery.length === 0) return null;

  const act = (draft: EditSession, action: () => Promise<void>) => {
    if (pending) return;
    setPending(draft.id);
    void action()
      .catch((cause: unknown) => toast.error(notify.error(cause)))
      .finally(() => {
        setPending(undefined);
      });
  };
  const continueDraft = (draft: EditSession) => {
    act(draft, async () => {
      const result = await session.continueDraft(draft);
      if (result === "missing") {
        toast.error(notify("studio.draftNoLongerAvailable"));
        return;
      }
      // The user chose other work while the draft was read; keep it.
      if (result === "superseded") return;
      void analytics.capture("editor_opened", { source: "draft" });
      props.onContinue();
    });
  };
  const saveAsSkin = (draft: EditSession) => {
    act(draft, async () => {
      const skin = await session.saveDraftAsSkin(draft);
      if (!skin) {
        toast.error(notify("studio.draftNoLongerAvailable"));
        return;
      }
      toast.success(notify("studio.draftSavedAsSkin", { name: skin.name }));
      props.onSavedSkin(skin);
    });
  };
  const discardDraft = (draft: EditSession) => {
    act(draft, async () => {
      await session.discardDraft(draft);
      toast(notify("studio.draftDiscarded"), {
        action: {
          label: notify("common.undo"),
          onClick: () =>
            void session
              .restoreDraft(draft)
              .catch((cause: unknown) => toast.error(notify.error(cause))),
        },
      });
    });
  };
  return (
    <div className="ph-no-capture">
      <Alert>
        <AlertTitle>{t("studio.continueUnsavedChanges")}</AlertTitle>
        <AlertDescription>
          <ItemGroup>
            {work.recovery.map((draft) => (
              <Item key={draft.id} render={<li />} size="xs">
                <ItemContent>
                  <ItemTitle className="min-w-0">
                    <span className="truncate">
                      {t.rich("studio.draftChanged", {
                        name: draft.name,
                        time: <CustomTimeAgo date={draft.updatedAt} />,
                      })}
                    </span>
                  </ItemTitle>
                  {work.orphans.includes(draft.id) && (
                    <ItemDescription>
                      {t("studio.draftSkinRemoved")}
                    </ItemDescription>
                  )}
                </ItemContent>
                <ItemActions>
                  <Button
                    size="sm"
                    disabled={pending !== undefined}
                    onClick={() => {
                      continueDraft(draft);
                    }}
                  >
                    {t("studio.continue")}
                  </Button>
                  {work.orphans.includes(draft.id) && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending !== undefined}
                      onClick={() => {
                        saveAsSkin(draft);
                      }}
                    >
                      {t("studio.saveAsNewSkin")}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending !== undefined}
                    onClick={() => {
                      discardDraft(draft);
                    }}
                  >
                    {t("studio.discard")}
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </AlertDescription>
      </Alert>
    </div>
  );
}
