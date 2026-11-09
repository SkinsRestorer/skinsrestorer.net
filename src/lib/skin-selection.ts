import { Effect } from "effect";
import { LatestTask } from "./latest-task";
import { readPngSize } from "./png";
import type { SkinImageError, SkinVariant } from "./skin";
import { withLibrary, type LibraryClient } from "./skin-library-client";
import {
  cleanSkinName,
  isEditableContent,
  prepareSkinContent,
  SkinLibrary,
  SkinNotFoundError,
  skinFile,
  type StoredSkin,
} from "./skin-library";

export type SelectionOrigin = "file" | "library" | "editor" | "handoff";

/** Whether the selected skin is also kept in this browser. */
export type KeepState =
  | { readonly kind: "saving" | "kept" | "removed" }
  | { readonly kind: "changed"; readonly latest: StoredSkin }
  | { readonly kind: "off"; readonly message: string };

/**
 * The form's skin. `file` is an in-memory copy made when the skin was chosen.
 * The preview shows it and generation sends it. Later changes to the library
 * record never change it; the picker offers the new version instead.
 */
export interface SelectedSkin {
  readonly token: number;
  readonly file: File;
  readonly name: string;
  readonly origin: SelectionOrigin;
  readonly status: "checking" | "ready" | "invalid";
  readonly error?: string;
  readonly skinId?: string;
  readonly revision?: number;
  readonly hash?: string;
  readonly width?: number;
  readonly height?: number;
  readonly keep: KeepState;
}

export interface SkinSelectionState {
  readonly selection: SelectedSkin | null;
  readonly variant: SkinVariant;
  readonly previewUrl: string | null;
}

export interface PreviewEvents {
  readonly preview: (url: string) => void;
  readonly detected: (variant: SkinVariant) => void;
  readonly failed: (cause: SkinImageError) => void;
}

export interface SkinSelectionDeps {
  /** Show the file and detect its model. Keeps running until aborted. */
  readonly preview: (
    file: File,
    events: PreviewEvents,
    signal: AbortSignal,
  ) => Promise<void>;
  readonly library?: LibraryClient;
  readonly events?: {
    readonly failed?: (token: number, message: string) => void;
    readonly imported?: (kept: number, failed: number) => void;
  };
}

export interface SelectOptions {
  readonly origin: SelectionOrigin;
  /** A model chosen by the user, for example in the editor or the library. */
  readonly variant?: SkinVariant;
  readonly name?: string;
  readonly link?: {
    readonly skinId: string;
    readonly revision: number;
    readonly hash: string;
  };
}

/**
 * Owns the selected skin of one Upload or Generator form. Selection never
 * waits for the library: the library only adds an id to the current
 * selection when its background write finishes. Every late result checks the
 * selection token, so an old file, detection, or write cannot replace a newer
 * choice.
 */
export class SkinSelectionStore {
  private state: SkinSelectionState = {
    selection: null,
    variant: "classic",
    previewUrl: null,
  };
  private readonly listeners = new Set<() => void>();
  private readonly detection = new LatestTask();
  private readonly variantSync = new LatestTask();
  private readonly check = new LatestTask();
  private token = 0;
  /** The user picked a model after the current selection started. */
  private variantChosen = false;
  private variantPending = false;
  private stopLibrary: (() => void) | undefined;

  constructor(private readonly deps: SkinSelectionDeps) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.state;

  /** Watch the library for changes to the selected skin. */
  connect() {
    this.stopLibrary?.();
    this.stopLibrary = this.deps.library?.subscribe(() => this.refresh());
    return () => this.dispose();
  }

  dispose() {
    this.stopLibrary?.();
    this.stopLibrary = undefined;
    this.detection.cancel();
    this.variantSync.cancel();
    this.check.cancel();
  }

  private set(next: Partial<SkinSelectionState>) {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }

  private update(token: number, change: Partial<SelectedSkin>) {
    const selection = this.state.selection;
    if (!selection || selection.token !== token) return false;
    this.set({ selection: { ...selection, ...change } });
    return true;
  }

  /**
   * Select files from the drop zone. The first one is selected at once. The
   * others are only kept in the library; nothing is generated for them.
   */
  selectFiles(files: readonly File[]) {
    const [first, ...rest] = files;
    if (!first) return;
    this.select(first, { origin: "file" });
    if (rest.length === 0) return;
    void Promise.allSettled(
      rest.map((file) => this.keepFile(file, undefined)),
    ).then((results) => {
      const failed = results.filter((r) => r.status === "rejected").length;
      this.deps.events?.imported?.(results.length - failed + 1, failed);
    });
  }

  select(file: File, options: SelectOptions) {
    const token = ++this.token;
    this.detection.cancel();
    this.variantSync.cancel();
    this.check.cancel();
    this.variantChosen = false;
    this.variantPending = false;
    const library = this.deps.library;
    this.set({
      selection: {
        token,
        file,
        name: options.name ?? cleanSkinName(file.name),
        origin: options.origin,
        status: "checking",
        skinId: options.link?.skinId,
        revision: options.link?.revision,
        hash: options.link?.hash,
        keep: options.link
          ? { kind: "kept" }
          : library
            ? { kind: "saving" }
            : { kind: "off", message: "This browser cannot keep skins." },
      },
      previewUrl: null,
    });
    const fail = (cause: unknown) => {
      const message = errorMessage(cause, "Failed to load image");
      this.update(token, { status: "invalid", error: message });
      this.deps.events?.failed?.(token, message);
    };
    void this.detection.run(
      async (signal) => {
        // An in-memory copy: a later change to the file on disk cannot change
        // what the form shows or sends.
        const bytes = await file.arrayBuffer();
        signal.throwIfAborted();
        const snapshot = new File([bytes], file.name, {
          type: "image/png",
          lastModified: file.lastModified,
        });
        const size = pngSize(new Uint8Array(bytes));
        await this.deps.preview(
          snapshot,
          {
            preview: (url) => {
              if (this.state.selection?.token === token)
                this.set({ previewUrl: url });
            },
            detected: (detected) => {
              const variant = this.variantChosen
                ? this.state.variant
                : (options.variant ?? detected);
              if (
                !this.update(token, {
                  file: snapshot,
                  status: "ready",
                  ...size,
                })
              )
                return;
              this.set({ variant });
              if (options.link) this.touch(options.link.skinId);
              else void this.keepSelection(token, snapshot, variant);
            },
            failed: fail,
          },
          signal,
        );
      },
      () => undefined,
      fail,
    );
  }

  selectSkin(skin: StoredSkin, origin: SelectionOrigin = "library") {
    this.select(skinFile(skin), {
      origin,
      name: skin.name,
      variant: skin.current.variant,
      link: {
        skinId: skin.id,
        revision: skin.revision,
        hash: skin.current.hash,
      },
    });
  }

  clear() {
    this.token++;
    this.detection.cancel();
    this.variantSync.cancel();
    this.check.cancel();
    this.set({ selection: null, previewUrl: null });
  }

  /** The user picked a model. It is saved to the kept skin in the background. */
  setVariant(variant: SkinVariant) {
    this.variantChosen = true;
    this.set({ variant });
    const selection = this.state.selection;
    if (
      !selection?.skinId ||
      selection.status !== "ready" ||
      selection.keep.kind !== "kept"
    )
      return;
    this.syncVariant(selection.token, selection.skinId, variant);
  }

  /** Use the newer version of the selected skin from the library. */
  useLatest() {
    const keep = this.state.selection?.keep;
    if (keep?.kind === "changed") this.selectSkin(keep.latest);
  }

  /** Check the selected skin after a change in this or another tab. */
  refresh() {
    const selection = this.state.selection;
    const library = this.deps.library;
    if (!selection?.skinId || !library) return;
    const { token, skinId } = selection;
    void this.check.run(
      (signal) => library.run(getSkin(skinId), signal),
      (skin) => {
        const current = this.state.selection;
        if (!current || current.token !== token) return;
        if (!skin) {
          this.update(token, { keep: { kind: "removed" }, skinId: undefined });
          return;
        }
        const sameModel =
          this.variantPending || skin.current.variant === this.state.variant;
        if (skin.current.hash === current.hash && sameModel)
          this.update(token, {
            name: skin.name,
            revision: skin.revision,
            keep: { kind: "kept" },
          });
        else
          this.update(token, {
            name: skin.name,
            keep: { kind: "changed", latest: skin },
          });
      },
      () => undefined,
    );
  }

  private touch(id: string) {
    void this.deps.library
      ?.run(withLibrary((library) => library.touch(id)))
      .catch(() => undefined);
  }

  private syncVariant(token: number, skinId: string, variant: SkinVariant) {
    const library = this.deps.library;
    if (!library) return;
    this.variantPending = true;
    void this.variantSync.run(
      (signal) =>
        library.run(
          withLibrary((store) => store.setVariant(skinId, variant)),
          signal,
        ),
      (skin) => {
        this.variantPending = false;
        if (this.state.variant !== variant) return;
        this.update(token, { revision: skin.revision });
      },
      (cause) => {
        this.variantPending = false;
        if (cause instanceof SkinNotFoundError)
          this.update(token, { keep: { kind: "removed" }, skinId: undefined });
      },
    );
  }

  private keepFile(file: Blob & { name?: string }, variant?: SkinVariant) {
    const library = this.deps.library;
    if (!library) return Promise.reject(new Error("No library"));
    return library.run(
      Effect.gen(function* () {
        const content = yield* prepareSkinContent(file, variant);
        const store = yield* SkinLibrary;
        return yield* store.add(
          {
            name: cleanSkinName(file.name ?? "Skin"),
            content,
            source: { kind: "file" },
          },
          { dedupe: true },
        );
      }),
    );
  }

  private async keepSelection(token: number, file: File, variant: SkinVariant) {
    if (!this.deps.library) return;
    try {
      const { skin } = await this.keepFile(file, variant);
      const linked = this.update(token, {
        name: skin.name,
        skinId: skin.id,
        revision: skin.revision,
        hash: skin.current.hash,
        keep: { kind: "kept" },
      });
      // The user may have picked another model while the skin was kept.
      if (linked && this.state.variant !== skin.current.variant)
        this.syncVariant(token, skin.id, this.state.variant);
    } catch (cause) {
      this.update(token, {
        keep: { kind: "off", message: errorMessage(cause, "Not kept.") },
      });
    }
  }
}

const getSkin = (id: string) =>
  withLibrary((library) =>
    library.get(id).pipe(
      Effect.map((skin): StoredSkin | undefined => skin),
      Effect.catchTag("SkinNotFoundError", () => Effect.succeed(undefined)),
    ),
  );

export function selectionEditable(selection: SelectedSkin | null) {
  if (!selection || selection.status !== "ready") return false;
  if (selection.width === undefined || selection.height === undefined)
    return true;
  return isEditableContent({
    width: selection.width,
    height: selection.height,
  });
}

function pngSize(bytes: Uint8Array) {
  try {
    return readPngSize(bytes);
  } catch {
    return {};
  }
}

function errorMessage(cause: unknown, fallback: string) {
  if (cause && typeof cause === "object" && "message" in cause)
    return String(cause.message);
  return fallback;
}

/** Everything a generation result depends on. */
export interface GenerationInput {
  /** `/skin url` or `/sr createcustom`. */
  readonly purpose: string;
  readonly file: File;
  readonly variant: SkinVariant;
  readonly method: string;
  readonly capeUuid: string;
  readonly name: string;
}

/**
 * A result belongs to the exact snapshot and options that produced it. The
 * file is compared by identity: each selection owns a new in-memory copy.
 */
export function sameGenerationInput(a: GenerationInput, b: GenerationInput) {
  return (
    a.purpose === b.purpose &&
    a.file === b.file &&
    a.variant === b.variant &&
    a.method === b.method &&
    a.capeUuid === b.capeUuid &&
    a.name === b.name
  );
}
