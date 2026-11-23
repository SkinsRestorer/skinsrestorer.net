import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export type StudioMode =
  | { readonly kind: "view" }
  | {
      readonly kind: "edit";
      readonly isNew: boolean;
      /** The `studioEditor` mark of this editor's history entry. */
      readonly entry: string;
    };

/**
 * The editor's own history entry. Opening the editor pushes an entry, so
 * Back returns to the view. Leaving that entry by Back, Forward, or a link
 * closes the editor, and Cancel or Save go back to the view's entry.
 * `onClose` runs whenever the editor closes.
 */
export function useEditorHistoryEntry(onClose: () => void) {
  const router = useRouter();
  const navigate = useNavigate();
  const [mode, setMode] = useState<StudioMode>({ kind: "view" });
  const editorMark = useRouterState({
    select: (routerState) => routerState.location.state.studioEditor,
  });
  const editorLocation = useRouterState({
    select: (routerState) => routerState.location.state.__TSR_key,
  });
  /** The entry this editor has reached, so leaving it closes the editor. */
  const reachedEntry = useRef<string>(undefined);
  const reachedLocation = useRef<string>(undefined);
  /** The entry Cancel or Save is going back from. */
  const leavingEntry = useRef<string>(undefined);

  const openEditor = (isNew: boolean) => {
    const entry = crypto.randomUUID();
    setMode({ kind: "edit", isNew, entry });
    void navigate({
      to: ".",
      search: true,
      state: { studioEditor: entry },
      resetScroll: false,
      ignoreBlocker: true,
    });
  };

  const closeEditor = () => {
    onClose();
    setMode({ kind: "view" });
  };

  /** Cancel or Save: close the editor and go back to the view's entry. */
  const exitEdit = (then?: () => void) => {
    const entry = mode.kind === "edit" ? mode.entry : undefined;
    closeEditor();
    if (!entry || router.history.location.state.studioEditor !== entry) {
      then?.();
      return;
    }
    leavingEntry.current = entry;
    if (then) {
      const stop = router.history.subscribe(() => {
        stop();
        then();
      });
    }
    router.history.back({ ignoreBlocker: true });
  };

  useEffect(() => {
    if (leavingEntry.current && editorMark !== leavingEntry.current)
      leavingEntry.current = undefined;
    if (mode.kind === "edit") {
      if (editorMark === mode.entry && reachedEntry.current !== mode.entry) {
        reachedEntry.current = mode.entry;
        reachedLocation.current = editorLocation;
      }
      // Back, Forward, or a link left the editor's entry. The blocker has
      // already asked about unsaved changes. A navigation can retain the
      // editor mark while still creating a different history entry.
      else if (
        reachedEntry.current === mode.entry &&
        (editorMark !== mode.entry ||
          editorLocation !== reachedLocation.current)
      )
        closeEditor();
      return;
    }
    // Forward or a reload reached an editor entry of a closed editor. Its
    // work is in drafts, so show the view instead of a different skin.
    if (editorMark && editorMark !== leavingEntry.current)
      void navigate({
        to: ".",
        search: true,
        replace: true,
        state: ({ studioEditor: _closed, ...rest }) => rest,
        resetScroll: false,
        ignoreBlocker: true,
      });
    // closeEditor and navigate are stable for this purpose.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [editorMark, editorLocation, mode]);

  return { mode, openEditor, exitEdit };
}
