import { errorMessage, message, type Message } from "@/lib/messages";
import { Debouncer } from "@tanstack/pacer";
import { Effect } from "effect";
import { encodePngSync } from "./png";
import type { SkinVariant } from "./skin";
import {
  exportSkinPng,
  importSkinPng,
  type SkinDocument,
} from "./skin-document";
import type { SkinEditorStore } from "./skin-editor-store";
import { SKIN_SIZE } from "./skin-regions";
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

/**
 * `saved` means a draft of this session was written. It stays set while
 * later changes wait for the next write, and ends with the session.
 */
type DraftStatus =
  | { readonly kind: "idle" | "saved" }
  | { readonly kind: "off"; readonly message: Message };

/** The result of continuing a recovered draft. */
export type ContinueResult = "continued" | "missing";

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

/** Each open editor holds a Web Lock with this prefix and its session id. */
const SESSION_LOCK = "skinsrestorer-session:";

/** The parts of the Web Locks API that mark live editor sessions. */
export interface SessionLocks {
  request(name: string, callback: () => Promise<void>): Promise<void>;
  query(): Promise<LockManagerSnapshot>;
}

interface EditorSessionOptions {
  readonly id?: () => string;
  readonly now?: () => number;
  readonly saveDelayMs?: number;
  /** The visitor's language, for copy names. English by default. */
  readonly locale?: Locale | undefined;
  /**
   * Marks the sessions of open editors, so other tabs do not offer them
   * for recovery. The browser's Web Locks by default, when it has them.
   */
  readonly locks?: SessionLocks | undefined;
}

function browserLocks(): SessionLocks | undefined {
  try {
    return typeof navigator === "undefined" ? undefined : navigator.locks;
  } catch {
    return undefined;
  }
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
  private readonly locks: SessionLocks | undefined;
  /** Releases the lock of the current session id. */
  private releaseLock: (() => void) | undefined;
  /** Draft writes get increasing numbers, so an older one cannot win. */
  private writes = 0;
  /** The newest draft write that has started, for each session. */
  private readonly started = new Map<string, number>();
  /** Cancels a recovery read that a newer one replaced. */
  private recoveryRead: AbortController | undefined;
  private recoveryFilter: { readonly skinId?: string | undefined } | undefined;

  constructor(
    store: SkinEditorStore,
    library: LibraryClient | undefined,
    options: EditorSessionOptions = {},
  ) {
    this.store = store;
    this.library = library;
    this.options = options;
    this.locks = "locks" in options ? options.locks : browserLocks();
    this.base = store.document();
    this.clean = store.getSnapshot().revision;
    this.state = {
      target: { name: "New skin" },
      sessionId: this.claim(this.newId()),
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
    this.recoveryRead?.abort();
    this.releaseLock?.();
    this.releaseLock = undefined;
    return written;
  }

  private newId() {
    return this.options.id?.() ?? crypto.randomUUID();
  }

  /**
   * Hold the lock of a session id while this editor owns it. The lock ends
   * with the tab, so a closed tab's draft becomes recoverable.
   */
  private claim(id: string) {
    this.releaseLock?.();
    this.releaseLock = undefined;
    const locks = this.locks;
    if (!locks) return id;
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.releaseLock = release;
    locks.request(`${SESSION_LOCK}${id}`, () => held).catch(() => {});
    return id;
  }

  /** Session ids that an open editor in any tab owns. */
  private async liveSessions() {
    const live = new Set<string>();
    if (!this.locks) return live;
    try {
      const snapshot = await this.locks.query();
      for (const lock of snapshot.held ?? [])
        if (lock.name?.startsWith(SESSION_LOCK))
          live.add(lock.name.slice(SESSION_LOCK.length));
    } catch {
      // Without the lock list, every other draft is offered.
    }
    return live;
  }

  /** A new session has no draft yet. */
  private draftsFor() {
    return this.state.drafts.kind === "saved"
      ? { kind: "idle" as const }
      : this.state.drafts;
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
      sessionId: this.claim(options.sessionId ?? this.newId()),
      dirty: this.clean === -1,
      drafts: this.draftsFor(),
    });
  }

  /**
   * List drafts that are not this editor's own work and that no open editor
   * in another tab owns. A newer call replaces a read that is still running.
   */
  async loadRecovery(filter?: {
    readonly skinId?: string | undefined;
  }): Promise<readonly EditSession[]> {
    const library = this.library;
    if (!library) return [];
    this.recoveryFilter = filter;
    this.recoveryRead?.abort();
    const read = new AbortController();
    this.recoveryRead = read;
    try {
      const [listing, live] = await Promise.all([
        library.run(
          withLibrary((l) => l.list),
          read.signal,
        ),
        this.liveSessions(),
      ]);
      if (read.signal.aborted) return this.state.recovery;
      const recovery = listing.sessions.filter(
        (session) =>
          session.id !== this.state.sessionId &&
          !live.has(session.id) &&
          (!filter || session.skinId === filter.skinId),
      );
      const skins = new Set(listing.skins.map((skin) => skin.id));
      const orphans = recovery
        .filter((draft) => draft.skinId && !skins.has(draft.skinId))
        .map((draft) => draft.id);
      this.set({ recovery, orphans });
      return recovery;
    } catch (cause) {
      if (read.signal.aborted) return this.state.recovery;
      this.unavailable = true;
      this.set({
        drafts: { kind: "off", message: errorMessage(cause) },
        recovery: [],
        orphans: [],
      });
      return [];
    }
  }

  /**
   * Continue a draft as this editor's own session. The result is `missing`
   * when the draft is gone, for example because another tab continued,
   * saved, or discarded it. It then leaves the recovery list.
   */
  async continueDraft(draft: EditSession): Promise<ContinueResult> {
    const library = this.library;
    if (!library) return "missing";
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
    try {
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
    } catch (cause) {
      if (!(cause instanceof SkinNotFoundError)) throw cause;
      this.forget(draft.id);
      return "missing";
    }
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
    // The continued draft is this session's draft.
    this.set({
      drafts:
        this.state.drafts.kind === "off"
          ? this.state.drafts
          : { kind: "saved" },
    });
    return "continued";
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

  /**
   * Delete a recovered draft. It leaves the list only after the delete
   * commits, so a failed delete keeps it offered.
   */
  async discardDraft(draft: EditSession) {
    const library = this.library;
    if (!library) return;
    await this.enqueue(() =>
      library.run(withLibrary((l) => l.deleteSession(draft.id))),
    );
    this.forget(draft.id);
  }

  /** Undo `discardDraft`: write the draft again and offer it again. */
  async restoreDraft(draft: EditSession) {
    const library = this.library;
    if (!library) return;
    await this.enqueue(() =>
      library.run(withLibrary((l) => l.saveSession(draft))),
    );
    await this.loadRecovery(this.recoveryFilter);
  }

  /**
   * Write this editor's draft before this call returns, for a page that
   * hides or closes. The browser may stop the page after the event, so the
   * PNG is not compressed and the database write starts in this call.
   * The returned promise ends when the write commits.
   */
  flushNow() {
    this.autosave.cancel();
    const library = this.library;
    // A running save deletes the draft when it commits; let it finish.
    if (this.state.busy) return this.flush();
    if (!library || this.unavailable || !this.state.dirty)
      return Promise.resolve();
    const { sessionId, target } = this.state;
    const document = this.store.document();
    const png = encodePngSync(document.pixels, SKIN_SIZE, SKIN_SIZE);
    return this.writeDraft(library, {
      sessionId,
      target,
      variant: document.variant,
      png,
      write: ++this.writes,
    });
  }

  /**
   * Start one draft write. The code before the first await runs in the
   * caller's task, and the library starts its transaction there once it is
   * open, so `flushNow` can call this during page hide.
   */
  private async writeDraft(
    library: LibraryClient,
    draft: {
      readonly sessionId: string;
      readonly target: EditTarget;
      readonly variant: SkinVariant;
      readonly png: Uint8Array<ArrayBuffer>;
      readonly write: number;
    },
  ) {
    const { sessionId, target } = draft;
    this.started.set(sessionId, draft.write);
    try {
      await library.run(
        withLibrary((l) =>
          l.saveSession({
            id: sessionId,
            skinId: target.skinId,
            baseRevision: target.baseRevision,
            name: target.name,
            png: pngBlob(draft.png),
            variant: draft.variant,
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
  }

  /** Write this editor's draft after earlier writes and saves. */
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
    const write = ++this.writes;
    return this.enqueue(async () => {
      // An earlier queued save may already have committed this work.
      if (this.state.sessionId === sessionId && !this.state.dirty) return;
      let png: Uint8Array<ArrayBuffer>;
      try {
        png = await exportSkinPng(document.pixels);
      } catch (cause) {
        if (this.state.sessionId === sessionId)
          this.set({ drafts: { kind: "off", message: errorMessage(cause) } });
        return;
      }
      // A page-hide write of newer work started while this PNG encoded.
      if ((this.started.get(sessionId) ?? 0) > write) return;
      await this.writeDraft(library, {
        sessionId,
        target,
        variant: document.variant,
        png,
        write,
      });
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
    this.set({ sessionId: this.claim(this.newId()), drafts: this.draftsFor() });
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
        // The save ended the draft.
        this.set({ drafts: this.draftsFor() });
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
