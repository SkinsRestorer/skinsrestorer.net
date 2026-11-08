import { Effect } from "effect";
import type { SkinVariant } from "./skin";
import {
  exportSkinPng,
  importSkinPng,
  type SkinDocument,
} from "./skin-document";
import type { SkinEditorStore } from "./skin-editor-store";
import { withLibrary, type LibraryClient } from "./skin-library-client";
import {
  copyName,
  prepareSkinContent,
  SkinChangedError,
  SkinLibraryError,
  SkinNotFoundError,
  type EditSession,
  type SkinContent,
  type StoredSkin,
} from "./skin-library";

/** The skin an editor works on. Without `skinId`, saving creates a skin. */
export interface EditTarget {
  readonly skinId?: string;
  /** The skin revision this work started from. */
  readonly baseRevision?: number;
  readonly name: string;
}

export type DraftStatus =
  | { readonly kind: "idle" | "saved" }
  | { readonly kind: "off"; readonly message: string };

export interface EditorSessionState {
  readonly target: EditTarget;
  readonly sessionId: string;
  readonly dirty: boolean;
  readonly busy: boolean;
  readonly drafts: DraftStatus;
  /** Unsaved work from earlier visits or other tabs that can be continued. */
  readonly recovery: readonly EditSession[];
}

export type SaveResult =
  | {
      readonly kind: "saved";
      readonly file: File;
      readonly name: string;
      readonly variant: SkinVariant;
      /** Undefined when the browser could not keep the skin. */
      readonly skin?: StoredSkin;
    }
  | { readonly kind: "changed"; readonly skin: StoredSkin }
  | { readonly kind: "removed" }
  | { readonly kind: "failed"; readonly message: string };

const SAVE_DELAY_MS = 500;

/**
 * Connect a SkinEditorStore to the library. Autosave writes only this
 * editor's own session record and never changes a skin. A skin changes only
 * through `save`, `saveCopy`, or `discard`, which the user chooses.
 */
export class EditorSession {
  private state: EditorSessionState;
  private readonly listeners = new Set<() => void>();
  private base: SkinDocument;
  private clean: number;
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** Session writes and saves run one at a time, in order. */
  private queue: Promise<void> = Promise.resolve();
  private stopStore: () => void;
  /** The library failed to open, so saves return the PNG only. */
  private unavailable = false;

  constructor(
    private readonly store: SkinEditorStore,
    private readonly library: LibraryClient | undefined,
    private readonly options: {
      readonly id?: () => string;
      readonly now?: () => number;
      readonly saveDelayMs?: number;
    } = {},
  ) {
    this.base = store.document();
    this.clean = store.getSnapshot().revision;
    this.state = {
      target: { name: "New skin" },
      sessionId: this.newId(),
      dirty: false,
      busy: false,
      drafts: library
        ? { kind: "idle" }
        : { kind: "off", message: "This browser cannot keep drafts." },
      recovery: [],
    };
    let revision = store.getSnapshot().revision;
    this.stopStore = store.subscribe(() => {
      const snapshot = store.getSnapshot();
      if (snapshot.revision !== revision) {
        revision = snapshot.revision;
        this.set({ dirty: revision !== this.clean });
      }
      clearTimeout(this.timer);
      if (this.state.dirty && !snapshot.painting)
        this.timer = setTimeout(
          () => this.flush(),
          options.saveDelayMs ?? SAVE_DELAY_MS,
        );
    });
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.state;

  dispose() {
    this.flush();
    this.stopStore();
  }

  private newId() {
    return this.options.id?.() ?? crypto.randomUUID();
  }

  private now() {
    return this.options.now?.() ?? Date.now();
  }

  private set(next: Partial<EditorSessionState>) {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }

  private enqueue<A>(task: () => Promise<A>) {
    const result = this.queue.then(task);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private markClean(revision: number, document: SkinDocument) {
    this.clean = revision;
    this.base = document;
    this.set({ dirty: this.store.getSnapshot().revision !== revision });
  }

  /** Start new work. Undo history starts again, so it cannot reach another skin. */
  start(
    document: SkinDocument,
    target: EditTarget,
    options: { readonly sessionId?: string; readonly base?: SkinDocument } = {},
  ) {
    clearTimeout(this.timer);
    this.store.load(document);
    this.base = options.base ?? document;
    // Continued drafts differ from the skin, so they start as unsaved.
    this.clean = options.base ? -1 : this.store.getSnapshot().revision;
    this.set({
      target,
      sessionId: options.sessionId ?? this.newId(),
      dirty: this.clean === -1,
    });
  }

  /** List drafts that are not this editor's own work. */
  async loadRecovery(filter?: { readonly skinId?: string }) {
    if (!this.library) return [];
    try {
      const listing = await this.library.run(withLibrary((l) => l.list));
      const recovery = listing.sessions.filter(
        (session) =>
          session.id !== this.state.sessionId &&
          (!filter || session.skinId === filter.skinId),
      );
      this.set({ recovery });
      return recovery;
    } catch (cause) {
      this.unavailable = true;
      this.set({
        drafts: { kind: "off", message: messageOf(cause) },
        recovery: [],
      });
      return [];
    }
  }

  /** Continue a draft as this editor's own session. */
  async continueDraft(draft: EditSession) {
    const library = this.library;
    if (!library) return;
    const imported = await importSkinPng(
      new Uint8Array(await draft.png.arrayBuffer()),
    );
    let base: SkinDocument | undefined;
    if (draft.skinId)
      try {
        const skin = await library.run(
          withLibrary((l) => l.get(draft.skinId!)),
        );
        base = await documentOf(skin.current.png, skin.current.variant);
      } catch {
        base = undefined;
      }
    const sessionId = this.newId();
    await this.enqueue(() =>
      library.run(
        withLibrary((l) =>
          l.continueSession(draft.id, {
            ...draft,
            id: sessionId,
            updatedAt: this.now(),
          }),
        ),
      ),
    );
    this.start(
      { pixels: imported.document.pixels, variant: draft.variant },
      {
        skinId: draft.skinId,
        baseRevision: draft.baseRevision,
        name: draft.name,
      },
      {
        sessionId,
        base: base ?? {
          pixels: imported.document.pixels,
          variant: draft.variant,
        },
      },
    );
    this.set({
      recovery: this.state.recovery.filter((entry) => entry.id !== draft.id),
    });
  }

  async discardDraft(id: string) {
    this.set({
      recovery: this.state.recovery.filter((entry) => entry.id !== id),
    });
    const library = this.library;
    if (!library) return;
    await this.enqueue(() =>
      library.run(withLibrary((l) => l.deleteSession(id))),
    );
  }

  /** Write this editor's draft now, for example when the page hides. */
  flush() {
    clearTimeout(this.timer);
    const library = this.library;
    if (!library || !this.state.dirty || this.state.drafts.kind === "off")
      return Promise.resolve();
    // Capture before queueing: opening another skin can replace the store
    // before this write starts, but the previous work still needs a draft.
    const { sessionId, target } = this.state;
    const document = this.store.document();
    return this.enqueue(async () => {
      // An earlier queued save may already have committed this work.
      if (this.state.sessionId === sessionId && !this.state.dirty) return;
      try {
        const png = await exportSkinPng(document.pixels);
        await library.run(
          withLibrary((l) =>
            l.saveSession({
              id: sessionId,
              skinId: target.skinId,
              baseRevision: target.baseRevision,
              name: target.name,
              png: pngBlob(png),
              variant: document.variant,
              updatedAt: this.now(),
            }),
          ),
        );
        if (this.state.sessionId === sessionId)
          this.set({ drafts: { kind: "saved" } });
      } catch (cause) {
        if (this.state.sessionId === sessionId)
          this.set({ drafts: { kind: "off", message: messageOf(cause) } });
      }
    });
  }

  /**
   * Save the work into its skin. If another tab saved the skin first, the
   * result is `changed` unless `replace` is set. Without a library, or with
   * `keep: false`, the result only returns the PNG.
   */
  save(options: { readonly replace?: boolean; readonly keep?: boolean } = {}) {
    return this.finish(async (content) => {
      const { target, sessionId } = this.state;
      const library =
        options.keep === false || this.unavailable ? undefined : this.library;
      if (!library) return { content, skin: undefined, name: target.name };
      const skin = target.skinId
        ? await library.run(
            withLibrary((l) =>
              l.commitSession({
                sessionId,
                skinId: target.skinId!,
                baseRevision: target.baseRevision ?? -1,
                content,
                replace: options.replace ?? false,
              }),
            ),
          )
        : await library.run(
            withLibrary((l) =>
              l.createFromSession({
                sessionId,
                skin: {
                  name: target.name,
                  content,
                  source: { kind: "editor" },
                },
              }),
            ),
          );
      return { content, skin, name: skin.name };
    });
  }

  /** Save the work as a new skin. The source skin does not change. */
  saveCopy(options: { readonly keep?: boolean } = {}) {
    return this.finish(async (content) => {
      const { target, sessionId } = this.state;
      const name = copyName(target.name);
      const library =
        options.keep === false || this.unavailable ? undefined : this.library;
      if (!library) return { content, skin: undefined, name };
      const skin = await library.run(
        withLibrary((l) =>
          l.createFromSession({
            sessionId,
            skin: {
              name,
              content,
              source: { kind: "copy", copiedFrom: target.skinId },
            },
          }),
        ),
      );
      return { content, skin, name: skin.name };
    });
  }

  /** Drop unsaved work and its draft. The skin does not change. */
  async discard() {
    clearTimeout(this.timer);
    const { sessionId } = this.state;
    this.store.load(this.base);
    this.markClean(this.store.getSnapshot().revision, this.base);
    this.set({ sessionId: this.newId() });
    const library = this.library;
    if (!library) return;
    await this.enqueue(() =>
      library
        .run(withLibrary((l) => l.deleteSession(sessionId)))
        .catch(() => undefined),
    );
  }

  private async finish(
    write: (content: SkinContent) => Promise<{
      content: SkinContent;
      skin: StoredSkin | undefined;
      name: string;
    }>,
  ): Promise<SaveResult> {
    clearTimeout(this.timer);
    this.set({ busy: true });
    const revision = this.store.getSnapshot().revision;
    const document = this.store.document();
    try {
      return await this.enqueue(async () => {
        const png = await exportSkinPng(document.pixels);
        const content = await Effect.runPromise(
          prepareSkinContent(pngBlob(png), document.variant),
        );
        const saved = await write(content);
        if (saved.skin)
          this.set({
            target: {
              skinId: saved.skin.id,
              baseRevision: saved.skin.revision,
              name: saved.skin.name,
            },
          });
        else this.set({ target: { ...this.state.target, name: saved.name } });
        this.markClean(revision, document);
        return {
          kind: "saved" as const,
          file: new File([saved.content.png], `${saved.name}.png`, {
            type: "image/png",
          }),
          name: saved.name,
          variant: document.variant,
          skin: saved.skin,
        };
      });
    } catch (cause) {
      if (cause instanceof SkinChangedError)
        return { kind: "changed", skin: cause.skin };
      if (cause instanceof SkinNotFoundError) return { kind: "removed" };
      return { kind: "failed", message: messageOf(cause) };
    } finally {
      this.set({ busy: false });
    }
  }
}

function pngBlob(png: Uint8Array) {
  return new Blob([png as Uint8Array<ArrayBuffer>], { type: "image/png" });
}

/** Open a stored PNG with an explicit model. */
export async function documentOf(
  png: Blob,
  variant: SkinVariant,
): Promise<SkinDocument> {
  const imported = await importSkinPng(new Uint8Array(await png.arrayBuffer()));
  return { pixels: imported.document.pixels, variant };
}

function messageOf(cause: unknown) {
  if (cause instanceof SkinLibraryError) return cause.message;
  if (cause && typeof cause === "object" && "message" in cause)
    return String(cause.message);
  return "Something went wrong.";
}
