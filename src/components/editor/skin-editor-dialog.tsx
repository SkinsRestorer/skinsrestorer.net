"use client";

import { X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";
import {
  SkinEditorWorkspace,
  useEditorSession,
} from "@/components/editor/skin-editor";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { documentOf, type SaveResult } from "@/lib/editor-session";
import type { SkinVariant } from "@/lib/skin";
import type { SkinDocument } from "@/lib/skin-document";
import { useT } from "@/lib/i18n-react";

export interface EditorDialogInitial {
  readonly file: File;
  readonly name: string;
  readonly variant: SkinVariant;
  readonly skinId?: string;
  readonly revision?: number;
}

const HISTORY_MARK = "skinsrestorerEditor";

/**
 * The editor over the Upload or Generator form. The form stays mounted
 * underneath, so its model, method, cape, key, and name do not change.
 */
export function SkinEditorDialog(props: {
  initial: EditorDialogInitial;
  onSaved: (result: Extract<SaveResult, { kind: "saved" }>) => void;
  onClose: () => void;
}) {
  const t = useT();
  const { initial, onClose } = props;
  const [document, setDocument] = useState<SkinDocument | null>(null);
  useEffect(() => {
    let active = true;
    documentOf(initial.file, initial.variant).then(
      (next) => {
        if (active) setDocument(next);
      },
      (cause: unknown) => {
        if (!active) return;
        toast.error(
          cause instanceof Error
            ? t(cause.message)
            : t("The skin could not be opened."),
        );
        onClose();
      },
    );
    return () => {
      active = false;
    };
  }, [initial, onClose, t]);
  if (!document) return null;
  return <EditorDialogBody {...props} document={document} />;
}

function EditorDialogBody(
  props: Parameters<typeof SkinEditorDialog>[0] & { document: SkinDocument },
) {
  const t = useT();
  const { initial, onClose } = props;
  const { store, session } = useEditorSession(props.document, {
    skinId: initial.skinId,
    baseRevision: initial.revision,
    name: initial.name,
  });
  const work = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const [asking, setAsking] = useState(false);
  const closed = useRef(false);

  const close = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    onClose();
  }, [onClose]);

  /** Esc, the close button, and Back all ask first when there are changes. */
  const requestClose = useCallback(() => {
    if (session.getSnapshot().dirty) setAsking(true);
    else close();
  }, [session, close]);

  // Back closes the editor instead of leaving the page.
  useEffect(() => {
    window.history.pushState(
      { ...window.history.state, [HISTORY_MARK]: true },
      "",
    );
    const pop = () => {
      if (closed.current) return;
      if (session.getSnapshot().dirty) {
        window.history.pushState(
          { ...window.history.state, [HISTORY_MARK]: true },
          "",
        );
        setAsking(true);
      } else close();
    };
    window.addEventListener("popstate", pop);
    return () => {
      window.removeEventListener("popstate", pop);
      if (window.history.state?.[HISTORY_MARK]) window.history.back();
    };
  }, [session, close]);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <DialogContent showCloseButton={false} size="fullscreen">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <DialogTitle>
            <span className="ph-no-capture line-clamp-1 break-all">
              {t("Edit {name}", { name: initial.name })}
            </span>
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("Close editor")}
            onClick={requestClose}
          >
            <X />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <SkinEditorWorkspace
            mode="dialog"
            store={store}
            session={session}
            onSaved={props.onSaved}
            onClose={close}
          />
        </div>
      </DialogContent>
      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Close the editor?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {work.drafts.kind === "off"
                ? t("Drafts are off, so closing loses your changes.")
                : t("Keep your changes as a draft, or discard them.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Keep editing")}</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                setAsking(false);
                void session.discard().then(close);
              }}
            >
              {t("Discard changes")}
            </Button>
            {work.drafts.kind !== "off" && (
              <Button
                onClick={() => {
                  setAsking(false);
                  void session.flush().then(close);
                }}
              >
                {t("Keep draft and close")}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
