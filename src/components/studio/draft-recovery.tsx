import { posthog } from "posthog-js";
import { useSyncExternalStore } from "react";
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
import { useT } from "@/lib/i18n-react";

export function DraftRecovery(props: {
  session: EditorSession;
  onContinue: () => void;
}) {
  const t = useT();
  const work = useSyncExternalStore(
    props.session.subscribe,
    props.session.getSnapshot,
    props.session.getSnapshot,
  );
  if (work.recovery.length === 0) return null;
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
                      {draft.name}
                      {t("studio.changed")}{" "}
                      <CustomTimeAgo date={draft.updatedAt} />
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
                    onClick={() =>
                      void props.session
                        .continueDraft(draft)
                        .then(() => {
                          posthog.capture("editor_opened", { source: "draft" });
                          props.onContinue();
                        })
                        .catch((cause) => toast.error(t.error(cause)))
                    }
                  >
                    {t("studio.continue")}
                  </Button>
                  {work.orphans.includes(draft.id) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void props.session
                          .saveDraftAsSkin(draft)
                          .catch((cause) => toast.error(t.error(cause)))
                      }
                    >
                      {t("studio.saveAsNewSkin")}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void props.session.discardDraft(draft.id)}
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
