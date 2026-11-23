import { posthog } from "posthog-js";
import { useState, useSyncExternalStore } from "react";
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
import { useNotificationT, useT } from "@/lib/i18n-react";
import type { EditSession } from "@/lib/skin-library";

export function DraftRecovery(props: {
  session: EditorSession;
  onContinue: () => void;
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
      posthog.capture("editor_opened", { source: "draft" });
      props.onContinue();
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
                        act(draft, async () => {
                          await session.saveDraftAsSkin(draft);
                        });
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
