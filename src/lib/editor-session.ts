import { errorMessage, message, type Message } from "@/lib/messages";
import { Debouncer } from "@tanstack/pacer";
import { Effect } from "effect";
import type { SkinVariant } from "./skin";
import {
  exportSkinPng,
  importSkinPng,
  type SkinDocument,
} from "./skin-document";
import type { SkinEditorStore } from "./skin-editor-store";
import { withLibrary, type LibraryClient } from "./skin-library-client";
import type { Locale } from "./i18n";
import {
  copyName,
  prepareSkinContent,
  skinFileName,
  SkinChangedError,
  SkinLibraryError,
  SkinNotFoundError,
  type EditSession,
  type SkinContent,
  type StoredSkin,
} from "./skin-library";

/** The skin an editor works on. Without `skinId`, saving creates a skin. */
export interface EditTarget {
  readonly skinId?: string | undefined;
  /** The skin revision this work started from. */
  readonly baseRevision?: number | undefined;
  readonly name: string;
}

type DraftStatus =
  | { readonly kind: "idle" | "saved" }
  | { readonly kind: "off"; readonly message: Message };

export interface EditorSessionState {
  readonly target: EditTarget;
  readonly sessionId: string;
  readonly dirty: boolean;
  readonly busy: boolean;
  readonly drafts: DraftStatus;
  /** Unsaved work from earlier visits or other tabs that can be continued. */
  readonly recovery: readonly EditSession[];
  /**
   * Ids of recovery drafts whose skin was removed, for example in another
   * tab. Continuing or saving such a draft creates a new skin.
   */
  readonly orphans: readonly string[];
}

export type SaveResult =
  | {
      readonly kind: "saved";
      readonly file: File;
      readonly name: string;
      readonly variant: SkinVariant;
      /** Undefined when the browser could not keep the skin. */
      readonly skin?: StoredSkin | undefined;
    }
  | { readonly kind: "changed"; readonly skin: StoredSkin }
  | { readonly kind: "removed" }
  | { readonly kind: "failed"; readonly message: Message };

const SAVE_DELAY_MS = 500;

interface EditorSessionOptions {
  readonly id?: () => string;
  readonly now?: () => number;
  readonly saveDelayMs?: number;
  /** The visitor's language, for copy names. English by default. */
  readonly locale?: Locale | undefined;
}

/**
 * Connect a SkinEditorStore to the library. Autosave writes only this
 * editor's own session record and never changes a skin. A skin changes only
 * through `save`, `saveCopy`, or `discard`, which the user chooses.
 */
export class EditorSession {
  private readonly store: SkinEditorStore;
  private readonly library: LibraryClient | undefined;
  private readonly options: EditorSessionOptions;
  private state: EditorSessionState;
  private readonly listeners = new Set<() => void>();
  private base: SkinDocument;
  private clean: number;
  /**
   * Schedules the draft write after the last change. It only decides when
   * `flush` runs; the queue below owns every write and its promise.
   */
  private readonly autosave: Debouncer<() => void>;
  /** Session writes and saves run one at a time, in order. */
  private queue: Promise<void> = Promise.resolve();
  private readonly stopStore: () => void;
  /** The library failed to open, so saves return the PNG only. */
  private unavailable = false;

  constructor(
    store: SkinEditorStore,
    library: LibraryClient | undefined,
    options: EditorSessionOptions = {},
  ) {
    this.store = store;
    this.library = library;
    this.options = options;
    this.base = store.document();
    this.clean = store.getSnapshot().revision;
    this.state = {
      target: { name: "New skin" },
      sessionId: this.newId(),
      dirty: false,
      busy: false,
      drafts: library
        ? { kind: "idle" }
        : { kind: "off", message: message("library.draftsUnavailable") },
      recovery: [],
      orphans: [],
    };
    this.autosave = new Debouncer<() => void>(() => void this.flush(), {
      wait: options.saveDelayMs ?? SAVE_DELAY_MS,
    });
    let revision = store.getSnapshot().revision;
    this.stopStore = store.subscribe(() => {
      const snapshot = store.getSnapshot();
      if (snapshot.revision !== revision) {
        revision = snapshot.revision;
        this.set({ dirty: revision !== this.clean });
      }
      // No draft writes during a stroke; the stroke's end schedules one.
      if (this.state.dirty && !snapshot.painting) this.autosave.maybeExecute();
      else this.autosave.cancel();
    });
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.state;

  /** Stop following the store. The returned promise ends after the last write. */
  dispose() {
    const written = this.flush();
    this.stopStore();
    return written;
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
    // The queue only orders tasks. Each caller handles its own result.
    this.queue = result.then(
      (): undefined => undefined,
      (): undefined => undefined,
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
    this.autosave.cancel();
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
  async loadRecovery(filter?: { readonly skinId?: string | undefined }) {
    if (!this.library) return [];
    try {
      const listing = await this.library.run(withLibrary((l) => l.list));
      const recovery = listing.sessions.filter(
        (session) =>
          session.id !== this.state.sessionId &&
          (!filter || session.skinId === filter.skinId),
      );
      const skins = new Set(listing.skins.map((skin) => skin.id));
      const orphans = recovery
        .filter((draft) => draft.skinId && !skins.has(draft.skinId))
        .map((draft) => draft.id);
      this.set({ recovery, orphans });
      return recovery;
    } catch (cause) {
      this.unavailable = true;
      this.set({
        drafts: { kind: "off", message: errorMessage(cause) },
        recovery: [],
        orphans: [],
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
    let owner = draft.skinId;
    if (owner)
      try {
        const skinId = owner;
        const skin = await library.run(withLibrary((l) => l.get(skinId)));
        base = await documentOf(skin.current.png, skin.current.variant);
      } catch (cause) {
        // The skin was removed after this draft was written. Continue it as
        // new work, so saving creates a skin instead of failing.
        if (cause instanceof SkinNotFoundError) owner = undefined;
        base = undefined;
      }
    const sessionId = this.newId();
    await this.enqueue(() =>
      library.run(
        withLibrary((l) =>
          l.continueSession(draft.id, {
            ...draft,
            id: sessionId,
            skinId: owner,
            baseRevision: owner ? draft.baseRevision : undefined,
            updatedAt: this.now(),
          }),
        ),
      ),
    );
    this.start(
      { pixels: imported.document.pixels, variant: draft.variant },
      owner
        ? { skinId: owner, baseRevision: draft.baseRevision, name: draft.name }
        : { name: draft.name },
      {
        sessionId,
        base: base ?? {
          pixels: imported.document.pixels,
          variant: draft.variant,
        },
      },
    );
    this.forget(draft.id);
  }

  /**
   * Keep a draft as a new skin without opening it, for example when its skin
   * was removed. The draft ends; the editor's own work does not change.
   */
  async saveDraftAsSkin(draft: EditSession): Promise<StoredSkin | undefined> {
    const library = this.library;
    if (!library) return undefined;
    const content = await Effect.runPromise(
      prepareSkinContent(draft.png, draft.variant),
    );
    const skin = await this.enqueue(() =>
      library.run(
        withLibrary((l) =>
          l.createFromSession({
            sessionId: draft.id,
            skin: { name: draft.name, content, source: { kind: "editor" } },
          }),
        ),
      ),
    );
    this.forget(draft.id);
    return skin;
  }

  private forget(id: string) {
    this.set({
      recovery: this.state.recovery.filter((entry) => entry.id !== id),
      orphans: this.state.orphans.filter((entry) => entry !== id),
    });
  }

  async discardDraft(id: string) {
    this.forget(id);
    const library = this.library;
    if (!library) return;
    await this.enqueue(() =>
      library.run(withLibrary((l) => l.deleteSession(id))),
    );
  }

  /** Write this editor's draft now, for example when the page hides. */
  flush() {
    this.autosave.cancel();
    const library = this.library;
    // A failed draft write is tried again with the next change, so drafts
    // come back after the user frees space. Only a library that cannot open
    // stops them.
    if (!library || this.unavailable || !this.state.dirty)
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
        if (isLibraryGone(cause)) this.unavailable = true;
        if (this.state.sessionId === sessionId)
          this.set({ drafts: { kind: "off", message: errorMessage(cause) } });
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
      const { skinId } = target;
      const skin = skinId
        ? await library.run(
            withLibrary((l) =>
              l.commitSession({
                sessionId,
                skinId,
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
      const name = copyName(target.name, this.options.locale);
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
    this.autosave.cancel();
    const { sessionId } = this.state;
    this.store.load(this.base);
    this.markClean(this.store.getSnapshot().revision, this.base);
    this.set({ sessionId: this.newId() });
    const library = this.library;
    if (!library) return;
    await this.enqueue(() =>
      library
        .run(withLibrary((l) => l.deleteSession(sessionId)))
        .catch(() => {}),
    );
  }

  private async finish(
    write: (content: SkinContent) => Promise<{
      content: SkinContent;
      skin: StoredSkin | undefined;
      name: string;
    }>,
  ): Promise<SaveResult> {
    this.autosave.cancel();
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
          file: new File([saved.content.png], skinFileName(saved.name), {
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
      return { kind: "failed", message: errorMessage(cause) };
    } finally {
      this.set({ busy: false });
    }
  }
}

/** The database did not open, so no later write can work. */
function isLibraryGone(cause: unknown) {
  return (
    cause instanceof SkinLibraryError &&
    (cause.reason === "unavailable" || cause.reason === "newer")
  );
}

function pngBlob(png: Uint8Array<ArrayBuffer>) {
  return new Blob([png], { type: "image/png" });
}

/** Open a stored PNG with an explicit model. */
export async function documentOf(
  png: Blob,
  variant: SkinVariant,
): Promise<SkinDocument> {
  const imported = await importSkinPng(new Uint8Array(await png.arrayBuffer()));
  return { pixels: imported.document.pixels, variant };
}
