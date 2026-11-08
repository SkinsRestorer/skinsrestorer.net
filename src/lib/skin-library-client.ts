import { Effect, type Layer, ManagedRuntime } from "effect";
import {
  DRAFT_KEY,
  discardDraft,
  readDraft,
  type KeyValueStorage,
} from "./skin-draft";
import { exportSkinPng } from "./skin-document";
import {
  LIBRARY_CHANNEL,
  prepareSkinContent,
  SkinLibrary,
  skinLibraryLayer,
  type LibraryEvent,
  type SkinLibraryError,
} from "./skin-library";

/**
 * Run library effects at framework boundaries. One runtime owns the database
 * connection for the page. If the database cannot open, every call fails with
 * the same SkinLibraryError and the page keeps working without it.
 */
export interface LibraryClient {
  run<A, E>(
    effect: Effect.Effect<A, E, SkinLibrary>,
    signal?: AbortSignal,
  ): Promise<A>;
  subscribe(listener: (event: LibraryEvent) => void): () => void;
  dispose(): Promise<void>;
}

export function createLibraryClient(
  layer: Layer.Layer<SkinLibrary, SkinLibraryError>,
): LibraryClient {
  const runtime = ManagedRuntime.make(layer);
  return {
    run: async (effect, signal) => {
      try {
        return await runtime.runPromise(effect, { signal });
      } catch (cause) {
        signal?.throwIfAborted();
        throw cause;
      }
    },
    subscribe: (listener) => {
      let active = true;
      let unsubscribe: (() => void) | undefined;
      runtime
        .runPromise(
          Effect.gen(function* () {
            const library = yield* SkinLibrary;
            return library.subscribe(listener);
          }),
        )
        .then(
          (stop) => {
            if (active) unsubscribe = stop;
            else stop();
          },
          () => undefined,
        );
      return () => {
        active = false;
        unsubscribe?.();
      };
    },
    dispose: () => runtime.dispose(),
  };
}

/** Run one library operation. */
export const withLibrary = <A, E>(
  f: (library: SkinLibrary["Service"]) => Effect.Effect<A, E>,
) =>
  Effect.gen(function* () {
    return yield* f(yield* SkinLibrary);
  });

let browserClient: LibraryClient | undefined;

/** The page's library, or undefined during server rendering. */
export function browserLibrary(): LibraryClient | undefined {
  if (typeof window === "undefined") return undefined;
  if (!browserClient) {
    let factory: IDBFactory | undefined;
    try {
      factory = window.indexedDB ?? undefined;
    } catch {
      factory = undefined;
    }
    browserClient = createLibraryClient(
      skinLibraryLayer({
        factory: factory ?? unavailableFactory,
        channel: () =>
          typeof BroadcastChannel === "undefined"
            ? undefined
            : new BroadcastChannel(LIBRARY_CHANNEL),
      }),
    );
  }
  return browserClient;
}

const unavailableFactory = {
  open: () => {
    throw new DOMException("IndexedDB is not available.", "SecurityError");
  },
} as unknown as IDBFactory;

export type MigrationResult =
  | { readonly status: "none" | "migrated" | "unavailable" }
  | { readonly status: "corrupt" | "newer" };

/**
 * Move the old single editor draft into the library. The skin id comes from
 * the draft text, so two tabs that migrate at once add one skin. The old key
 * is removed only after the transaction commits. A damaged or newer draft is
 * left in place.
 */
export async function migrateLegacyDraft(
  client: LibraryClient,
  storage: KeyValueStorage | undefined,
): Promise<MigrationResult> {
  // Decode and identify the same snapshot, even if an older tab still writes
  // legacy drafts while the PNG is being decoded or the database opens.
  let raw: string | null;
  try {
    raw = storage?.getItem(DRAFT_KEY) ?? null;
  } catch {
    return { status: "unavailable" };
  }
  if (raw === null) return { status: "none" };
  const draft = await readDraft({ getItem: () => raw });
  if (draft.status === "corrupt" || draft.status === "newer")
    return { status: draft.status };
  if (draft.status !== "found") return { status: "none" };
  const id = `draft-${await textHash(raw)}`;
  const date = new Date(draft.updatedAt).toLocaleDateString();
  const { created } = await client.run(
    Effect.gen(function* () {
      const library = yield* SkinLibrary;
      const png = yield* Effect.promise(() =>
        exportSkinPng(draft.document.pixels),
      );
      const content = yield* prepareSkinContent(
        new Blob([png as Uint8Array<ArrayBuffer>], { type: "image/png" }),
        draft.document.variant,
      );
      return yield* library.migrate({
        id,
        createdAt: draft.updatedAt,
        skin: {
          name: `Recovered draft (${date})`,
          content,
          source: { kind: "migrated-draft" },
        },
      });
    }),
  );
  try {
    if (storage?.getItem(DRAFT_KEY) === raw) discardDraft(storage);
  } catch {
    // The migrated snapshot is safe; leave the legacy draft if unreadable.
  }
  // Another tab may have moved the same draft first.
  return { status: created ? "migrated" : "none" };
}

async function textHash(text: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest).subarray(0, 16), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
