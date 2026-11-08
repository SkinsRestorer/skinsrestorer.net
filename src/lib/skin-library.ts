import { Context, Data, Effect, Layer, Schema } from "effect";
import { PngError, readPngSize } from "./png";
import { validateSkinDimensions, type SkinVariant } from "./skin";
import { importSkinPng, MAX_SKIN_FILE_BYTES } from "./skin-document";

/**
 * Skins kept in this browser. One IndexedDB database holds two stores:
 * `skins` (the original and current PNG of each skin) and `sessions` (unsaved
 * editor work). Nothing here uses the network.
 */
export const LIBRARY_DB = "skinsrestorer-skins";
export const LIBRARY_VERSION = 1;
export const LIBRARY_CHANNEL = "skinsrestorer-skins";
export const MAX_SKIN_NAME_LENGTH = 80;
const SKINS = "skins";
const SESSIONS = "sessions";

export type LibraryFailure =
  | "unavailable"
  | "full"
  | "newer"
  | "closed"
  | "invalid"
  | "damaged"
  | "failed";

export class SkinLibraryError extends Data.TaggedError("SkinLibraryError")<{
  readonly reason: LibraryFailure;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class SkinNotFoundError extends Data.TaggedError("SkinNotFoundError")<{
  readonly id: string;
  readonly message: string;
}> {}

/** Another tab saved this skin after the edit session started. */
export class SkinChangedError extends Data.TaggedError("SkinChangedError")<{
  readonly skin: StoredSkin;
  readonly message: string;
}> {}

const failureMessages: Record<LibraryFailure, string> = {
  unavailable:
    "This browser does not let the site keep skins, for example in a private window or with blocked site data.",
  full: "Browser storage for this site is full.",
  newer:
    "A newer version of this site changed the skins kept in this browser. Reload the page.",
  closed:
    "Another tab updated the skins kept in this browser. Reload the page.",
  invalid: "This file is not a skin PNG.",
  damaged: "A kept skin could not be read.",
  failed: "The browser could not save the skin.",
};

export function libraryError(
  reason: LibraryFailure,
  cause?: unknown,
  message = failureMessages[reason],
) {
  return new SkinLibraryError({ reason, message, cause });
}

function storageError(cause: unknown) {
  const name = cause instanceof DOMException ? cause.name : "";
  if (name === "QuotaExceededError") return libraryError("full", cause);
  if (name === "InvalidStateError") return libraryError("closed", cause);
  if (name === "VersionError") return libraryError("newer", cause);
  if (name === "SecurityError" || name === "InvalidAccessError")
    return libraryError("unavailable", cause);
  return libraryError("failed", cause);
}

const variantSchema = Schema.Literals(["classic", "slim"]);
const contentSchema = Schema.Struct({
  png: Schema.instanceOf(Blob),
  /** SHA-256 of the PNG bytes. Identifies the exact file a form sends. */
  hash: Schema.String,
  /** Canonical decoded pixels. HD images use their file bytes instead. */
  pixelKey: Schema.String,
  /** The pixels and the model. Finds a repeated import of the same skin. */
  key: Schema.String,
  variant: variantSchema,
  width: Schema.Number,
  height: Schema.Number,
});
const sourceSchema = Schema.Struct({
  kind: Schema.Literals([
    "file",
    "texture",
    "editor",
    "copy",
    "migrated-draft",
  ]),
  textureHash: Schema.optional(Schema.String),
  copiedFrom: Schema.optional(Schema.String),
});
const skinSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  current: contentSchema,
  original: contentSchema,
  /** Changes with every pixel or model change. Saves compare it. */
  revision: Schema.Number,
  source: sourceSchema,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  lastUsedAt: Schema.Number,
});
const sessionSchema = Schema.Struct({
  id: Schema.String,
  skinId: Schema.optional(Schema.String),
  baseRevision: Schema.optional(Schema.Number),
  name: Schema.String,
  png: Schema.instanceOf(Blob),
  variant: variantSchema,
  updatedAt: Schema.Number,
});

export type SkinContent = typeof contentSchema.Type;
export type SkinSource = typeof sourceSchema.Type;
export type StoredSkin = typeof skinSchema.Type;
/** Unsaved editor work. Each open editor owns exactly one session id. */
export type EditSession = typeof sessionSchema.Type;

const decodeSkin = Schema.decodeUnknownOption(skinSchema);
const decodeSession = Schema.decodeUnknownOption(sessionSchema);

export interface DamagedRecord {
  readonly store: "skins" | "sessions";
  readonly key: IDBValidKey;
}

export interface LibraryListing {
  /** Most recently used first. */
  readonly skins: readonly StoredSkin[];
  readonly sessions: readonly EditSession[];
  readonly damaged: readonly DamagedRecord[];
}

export interface NewSkin {
  readonly name: string;
  readonly content: SkinContent;
  readonly source: SkinSource;
}

export interface RemovedSkin {
  readonly skin: StoredSkin;
  readonly sessions: readonly EditSession[];
}

export type LibraryEvent = { readonly type: "changed" | "closed" };

export function cleanSkinName(name: string, fallback = "Skin") {
  const clean = name
    .replace(/\.png$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SKIN_NAME_LENGTH);
  return clean || fallback;
}

async function sha256(bytes: Uint8Array | Uint8ClampedArray) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes as Uint8Array<ArrayBuffer>,
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function isEditableContent(
  content: Pick<SkinContent, "width" | "height">,
) {
  return (
    content.width === 64 && (content.height === 64 || content.height === 32)
  );
}

/**
 * Read, check, and hash a PNG before any transaction starts. The stored blob
 * is an in-memory copy, so a later change to the file on disk does not change
 * it. The form accepts the same image shapes as the upload pages; only 64×64
 * and 64×32 images are decoded to canonical pixels.
 */
export const prepareSkinContent = Effect.fn("SkinLibrary.prepare")(function* (
  source: Blob,
  variant?: SkinVariant,
) {
  if (source.size > MAX_SKIN_FILE_BYTES)
    return yield* libraryError(
      "invalid",
      undefined,
      "The file is larger than 5 MB.",
    );
  const bytes = yield* Effect.tryPromise({
    try: async () => new Uint8Array(await source.arrayBuffer()),
    catch: (cause) =>
      libraryError("invalid", cause, "The file could not be read."),
  });
  const size = yield* Effect.try({
    try: () => {
      const size = readPngSize(bytes);
      validateSkinDimensions(size.width, size.height);
      return size;
    },
    catch: (cause) =>
      libraryError(
        "invalid",
        cause,
        cause instanceof Error && !(cause instanceof PngError)
          ? cause.message
          : failureMessages.invalid,
      ),
  });
  const hash = yield* Effect.promise(() => sha256(bytes));
  let pixelKey = `file:${hash}`;
  let detected: SkinVariant = "classic";
  if (isEditableContent(size)) {
    const imported = yield* Effect.tryPromise({
      try: () => importSkinPng(bytes),
      catch: (cause) =>
        libraryError(
          "invalid",
          cause,
          cause instanceof Error ? cause.message : failureMessages.invalid,
        ),
    });
    pixelKey = `pixels:${yield* Effect.promise(() => sha256(imported.document.pixels))}`;
    detected = imported.document.variant;
  }
  const model = variant ?? detected;
  return {
    png: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "image/png" }),
    hash,
    pixelKey,
    key: `${pixelKey}:${model}`,
    variant: model,
    width: size.width,
    height: size.height,
  } satisfies SkinContent;
});

export function withVariant(
  content: SkinContent,
  variant: SkinVariant,
): SkinContent {
  return { ...content, variant, key: `${content.pixelKey}:${variant}` };
}

export function skinFile(skin: Pick<StoredSkin, "name" | "current">) {
  return new File([skin.current.png], `${skin.name}.png`, {
    type: "image/png",
  });
}

export class SkinLibrary extends Context.Service<
  SkinLibrary,
  {
    readonly list: Effect.Effect<LibraryListing, SkinLibraryError>;
    readonly get: (
      id: string,
    ) => Effect.Effect<StoredSkin, SkinLibraryError | SkinNotFoundError>;
    /** Add a skin. With `dedupe`, a skin with the same pixels and model is reused. */
    readonly add: (
      skin: NewSkin,
      options: { readonly dedupe: boolean },
    ) => Effect.Effect<
      { readonly skin: StoredSkin; readonly created: boolean },
      SkinLibraryError
    >;
    readonly touch: (id: string) => Effect.Effect<void, SkinLibraryError>;
    readonly rename: (
      id: string,
      name: string,
    ) => Effect.Effect<StoredSkin, SkinLibraryError | SkinNotFoundError>;
    readonly setVariant: (
      id: string,
      variant: SkinVariant,
    ) => Effect.Effect<StoredSkin, SkinLibraryError | SkinNotFoundError>;
    /** Replace the current version, for example to undo a revert. */
    readonly setContent: (
      id: string,
      content: SkinContent,
    ) => Effect.Effect<StoredSkin, SkinLibraryError | SkinNotFoundError>;
    /** Restore the original bytes and the original model. */
    readonly revert: (
      id: string,
    ) => Effect.Effect<
      { readonly skin: StoredSkin; readonly previous: SkinContent },
      SkinLibraryError | SkinNotFoundError
    >;
    /** Always a new skin, even when the pixels are the same. */
    readonly duplicate: (
      id: string,
    ) => Effect.Effect<StoredSkin, SkinLibraryError | SkinNotFoundError>;
    /** Remove a skin and its sessions in one transaction. */
    readonly remove: (
      id: string,
    ) => Effect.Effect<RemovedSkin, SkinLibraryError | SkinNotFoundError>;
    /** Undo a removal. Records that exist again are left as they are. */
    readonly restore: (
      removed: RemovedSkin,
    ) => Effect.Effect<void, SkinLibraryError>;
    readonly removeDamaged: (
      record: DamagedRecord,
    ) => Effect.Effect<void, SkinLibraryError>;
    /** Write one session. It never changes a skin or another session. */
    readonly saveSession: (
      session: EditSession,
    ) => Effect.Effect<void, SkinLibraryError>;
    readonly deleteSession: (
      id: string,
    ) => Effect.Effect<void, SkinLibraryError>;
    /** Move a recovered draft to a new session owned by this editor. */
    readonly continueSession: (
      fromId: string,
      next: EditSession,
    ) => Effect.Effect<void, SkinLibraryError | SkinNotFoundError>;
    /**
     * Save a session into its skin and delete the session. Unless `replace` is
     * set, the save fails if the skin's revision is not `baseRevision`.
     */
    readonly commitSession: (input: {
      readonly sessionId: string;
      readonly skinId: string;
      readonly baseRevision: number;
      readonly content: SkinContent;
      readonly replace: boolean;
    }) => Effect.Effect<
      StoredSkin,
      SkinLibraryError | SkinNotFoundError | SkinChangedError
    >;
    /** Save editor work as a new skin and delete its session. */
    readonly createFromSession: (input: {
      readonly sessionId: string;
      readonly skin: NewSkin;
    }) => Effect.Effect<StoredSkin, SkinLibraryError>;
    /** Add a migrated draft under a fixed id. A second call does nothing. */
    readonly migrate: (input: {
      readonly id: string;
      readonly skin: NewSkin;
      readonly createdAt: number;
    }) => Effect.Effect<{ readonly created: boolean }, SkinLibraryError>;
    readonly subscribe: (listener: (event: LibraryEvent) => void) => () => void;
  }
>()("skinsrestorer/SkinLibrary") {}

/** The parts of BroadcastChannel the library uses. */
export interface LibraryChannel {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: () => void): void;
  close(): void;
}

export interface LibraryOptions {
  readonly factory: IDBFactory;
  readonly name?: string;
  readonly channel?: () => LibraryChannel | undefined;
  readonly now?: () => number;
  readonly id?: () => string;
  readonly openTimeoutMs?: number;
}

/** Open the database. A newer version on disk is reported, never replaced. */
function openDatabase(factory: IDBFactory, name: string, timeoutMs: number) {
  return Effect.callback<IDBDatabase, SkinLibraryError>((resume) => {
    let request: IDBOpenDBRequest;
    let settled = false;
    try {
      request = factory.open(name, LIBRARY_VERSION);
    } catch (cause) {
      resume(Effect.fail(libraryError("unavailable", cause)));
      return;
    }
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (event.oldVersion < 1) {
        const skins = db.createObjectStore(SKINS, { keyPath: "id" });
        skins.createIndex("key", "current.key");
        skins.createIndex("lastUsedAt", "lastUsedAt");
        const sessions = db.createObjectStore(SESSIONS, { keyPath: "id" });
        sessions.createIndex("skinId", "skinId");
      }
    };
    request.onsuccess = () => {
      settled = true;
      resume(Effect.succeed(request.result));
    };
    request.onerror = (event) => {
      settled = true;
      event.preventDefault();
      const error = request.error;
      resume(
        Effect.fail(
          error?.name === "VersionError"
            ? libraryError("newer", error)
            : libraryError("unavailable", error),
        ),
      );
    };
    return Effect.sync(() => {
      if (settled) return;
      // The open may still finish after cancellation. Close it then.
      request.onsuccess = () => request.result.close();
      request.onerror = (event) => event.preventDefault();
    });
  }).pipe(
    Effect.timeoutOrElse({
      duration: timeoutMs,
      orElse: () => Effect.fail(libraryError("unavailable")),
    }),
  );
}

/**
 * Run one transaction. `body` queues requests synchronously and returns a
 * function that reads the result. The effect succeeds only when the
 * transaction commits. Interruption aborts the transaction, and `fail` aborts
 * it with a domain error. No other await happens while it is active.
 */
function transaction<A, E = never>(
  db: () => IDBDatabase,
  stores: readonly string[],
  mode: IDBTransactionMode,
  body: (tx: IDBTransaction, fail: (error: E) => void) => () => A,
  durability: "default" | "strict" = "default",
) {
  return Effect.callback<A, E | SkinLibraryError>((resume) => {
    let tx: IDBTransaction;
    let done = false;
    let failure: { readonly error: E } | undefined;
    const finish = (effect: Effect.Effect<A, E | SkinLibraryError>) => {
      if (done) return;
      done = true;
      resume(effect);
    };
    try {
      tx = db().transaction(stores as string[], mode, { durability });
    } catch (cause) {
      finish(Effect.fail(storageError(cause)));
      return;
    }
    const fail = (error: E) => {
      if (failure) return;
      failure = { error };
      try {
        tx.abort();
      } catch {
        // The transaction already finished.
      }
    };
    let read: () => A;
    try {
      read = body(tx, fail);
    } catch (cause) {
      try {
        tx.abort();
      } catch {
        // The transaction already finished.
      }
      finish(Effect.fail(storageError(cause)));
      return;
    }
    tx.oncomplete = () => finish(Effect.sync(read));
    tx.onabort = () =>
      finish(Effect.fail(failure ? failure.error : storageError(tx.error)));
    return Effect.sync(() => {
      if (done) return;
      done = true;
      try {
        tx.abort();
      } catch {
        // The transaction already finished.
      }
    });
  });
}

function onResult<T>(request: IDBRequest<T>, use: (value: T) => void) {
  request.onsuccess = () => use(request.result);
}

const notFound = (id: string) =>
  new SkinNotFoundError({
    id,
    message: "This skin is no longer kept in this browser.",
  });

export const makeSkinLibrary = Effect.fn("SkinLibrary.make")(function* (
  options: LibraryOptions,
) {
  const now = options.now ?? Date.now;
  const newId = options.id ?? (() => crypto.randomUUID());
  const listeners = new Set<(event: LibraryEvent) => void>();
  const emit = (event: LibraryEvent) => {
    for (const listener of listeners) listener(event);
  };
  const database = yield* Effect.acquireRelease(
    openDatabase(
      options.factory,
      options.name ?? LIBRARY_DB,
      options.openTimeoutMs ?? 5000,
    ),
    (db) => Effect.sync(() => db.close()),
  );
  // A newer page wants to upgrade the database. Close this connection so it
  // is not blocked; later calls fail with a "reload" message.
  database.onversionchange = () => {
    database.close();
    emit({ type: "closed" });
  };
  const channel = yield* Effect.acquireRelease(
    Effect.sync(() => {
      const channel = options.channel?.();
      channel?.addEventListener("message", () => emit({ type: "changed" }));
      return channel;
    }),
    (channel) => Effect.sync(() => channel?.close()),
  );
  const changed = Effect.sync(() => {
    emit({ type: "changed" });
    try {
      channel?.postMessage({ type: "changed" });
    } catch {
      // Other tabs refresh when they next read the list.
    }
  });
  const db = () => database;

  const read = <A, E = never>(
    stores: readonly string[],
    body: (tx: IDBTransaction, fail: (error: E) => void) => () => A,
  ) => transaction<A, E>(db, stores, "readonly", body);
  const write = <A, E = never>(
    stores: readonly string[],
    body: (tx: IDBTransaction, fail: (error: E) => void) => () => A,
    durability: "default" | "strict" = "default",
  ) =>
    transaction<A, E>(db, stores, "readwrite", body, durability).pipe(
      Effect.tap(() => changed),
    );

  /** Read a skin inside a transaction, then change it. */
  const updateSkin = (
    id: string,
    change: (skin: StoredSkin, at: number) => StoredSkin,
  ) =>
    write<StoredSkin, SkinNotFoundError | SkinLibraryError>(
      [SKINS],
      (tx, fail) => {
        let result: StoredSkin | undefined;
        const store = tx.objectStore(SKINS);
        onResult(store.get(id), (value) => {
          if (value === undefined) return fail(notFound(id));
          const skin = decodeSkin(value);
          if (skin._tag === "None") return fail(libraryError("damaged"));
          result = change(skin.value, now());
          store.put(result);
        });
        return () => result!;
      },
    );

  const create = (skin: NewSkin, at: number, id = newId()): StoredSkin => ({
    id,
    name: cleanSkinName(skin.name),
    current: skin.content,
    original: skin.content,
    revision: 1,
    source: skin.source,
    createdAt: at,
    updatedAt: at,
    lastUsedAt: at,
  });

  return SkinLibrary.of({
    list: read([SKINS, SESSIONS], (tx) => {
      const listing = {
        skins: [] as StoredSkin[],
        sessions: [] as EditSession[],
        damaged: [] as DamagedRecord[],
      };
      onResult(tx.objectStore(SKINS).getAll(), (values) => {
        for (const value of values) {
          const skin = decodeSkin(value);
          if (skin._tag === "Some") listing.skins.push(skin.value);
          else listing.damaged.push({ store: "skins", key: value?.id });
        }
      });
      onResult(tx.objectStore(SESSIONS).getAll(), (values) => {
        for (const value of values) {
          const session = decodeSession(value);
          if (session._tag === "Some") listing.sessions.push(session.value);
          else listing.damaged.push({ store: "sessions", key: value?.id });
        }
      });
      return () => {
        listing.skins.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
        listing.sessions.sort((a, b) => b.updatedAt - a.updatedAt);
        return listing;
      };
    }),
    get: (id) =>
      read<StoredSkin | undefined, SkinLibraryError>([SKINS], (tx, fail) => {
        let result: StoredSkin | undefined;
        onResult(tx.objectStore(SKINS).get(id), (value) => {
          if (value === undefined) return;
          const skin = decodeSkin(value);
          if (skin._tag === "None") fail(libraryError("damaged"));
          else result = skin.value;
        });
        return () => result;
      }).pipe(
        Effect.flatMap((skin) =>
          skin ? Effect.succeed(skin) : Effect.fail(notFound(id)),
        ),
      ),
    add: (skin, { dedupe }) =>
      write([SKINS], (tx) => {
        const store = tx.objectStore(SKINS);
        const at = now();
        let result: { skin: StoredSkin; created: boolean } | undefined;
        const insert = () => {
          const created = create(skin, at);
          store.add(created);
          result = { skin: created, created: true };
        };
        if (!dedupe) insert();
        else
          onResult(store.index("key").getAll(skin.content.key), (values) => {
            const match = values
              .map((value) => decodeSkin(value))
              .flatMap((decoded) =>
                decoded._tag === "Some" ? [decoded.value] : [],
              )
              .sort((a, b) => b.lastUsedAt - a.lastUsedAt)[0];
            if (!match) return insert();
            const used = { ...match, lastUsedAt: at };
            store.put(used);
            result = { skin: used, created: false };
          });
        return () => result!;
      }),
    touch: (id) =>
      write([SKINS], (tx) => {
        const store = tx.objectStore(SKINS);
        onResult(store.get(id), (value) => {
          const skin = decodeSkin(value);
          if (skin._tag === "Some")
            store.put({ ...skin.value, lastUsedAt: now() });
        });
        return () => undefined;
      }),
    rename: (id, name) =>
      updateSkin(id, (skin) => ({
        ...skin,
        name: cleanSkinName(name, skin.name),
      })),
    setVariant: (id, variant) =>
      updateSkin(id, (skin, at) =>
        skin.current.variant === variant
          ? skin
          : {
              ...skin,
              current: withVariant(skin.current, variant),
              revision: skin.revision + 1,
              updatedAt: at,
            },
      ),
    setContent: (id, content) =>
      updateSkin(id, (skin, at) => ({
        ...skin,
        current: content,
        revision: skin.revision + 1,
        updatedAt: at,
      })),
    revert: (id) => {
      let previous: SkinContent | undefined;
      return updateSkin(id, (skin, at) => {
        previous = skin.current;
        return {
          ...skin,
          current: skin.original,
          revision: skin.revision + 1,
          updatedAt: at,
        };
      }).pipe(Effect.map((skin) => ({ skin, previous: previous! })));
    },
    duplicate: (id) =>
      write<StoredSkin, SkinNotFoundError | SkinLibraryError>(
        [SKINS],
        (tx, fail) => {
          const store = tx.objectStore(SKINS);
          let result: StoredSkin | undefined;
          onResult(store.get(id), (value) => {
            if (value === undefined) return fail(notFound(id));
            const skin = decodeSkin(value);
            if (skin._tag === "None") return fail(libraryError("damaged"));
            result = create(
              {
                name: copyName(skin.value.name),
                content: skin.value.current,
                source: { kind: "copy", copiedFrom: id },
              },
              now(),
            );
            store.add(result);
          });
          return () => result!;
        },
      ),
    remove: (id) =>
      write<RemovedSkin, SkinNotFoundError | SkinLibraryError>(
        [SKINS, SESSIONS],
        (tx, fail) => {
          const skins = tx.objectStore(SKINS);
          const sessions = tx.objectStore(SESSIONS);
          let skin: StoredSkin | undefined;
          const removedSessions: EditSession[] = [];
          onResult(skins.get(id), (value) => {
            if (value === undefined) return fail(notFound(id));
            const decoded = decodeSkin(value);
            if (decoded._tag === "None") return fail(libraryError("damaged"));
            skin = decoded.value;
            skins.delete(id);
          });
          onResult(sessions.index("skinId").getAll(id), (values) => {
            for (const value of values) {
              const session = decodeSession(value);
              if (session._tag === "Some") removedSessions.push(session.value);
              sessions.delete(value.id);
            }
          });
          return () => ({ skin: skin!, sessions: removedSessions });
        },
      ),
    restore: (removed) =>
      write([SKINS, SESSIONS], (tx) => {
        const skins = tx.objectStore(SKINS);
        const sessions = tx.objectStore(SESSIONS);
        onResult(skins.getKey(removed.skin.id), (key) => {
          if (key === undefined) skins.add(removed.skin);
        });
        for (const session of removed.sessions)
          onResult(sessions.getKey(session.id), (key) => {
            if (key === undefined) sessions.add(session);
          });
        return () => undefined;
      }),
    removeDamaged: (record) =>
      write([record.store], (tx) => {
        tx.objectStore(record.store).delete(record.key);
        return () => undefined;
      }),
    saveSession: (session) =>
      write([SESSIONS], (tx) => {
        tx.objectStore(SESSIONS).put(session);
        return () => undefined;
      }),
    deleteSession: (id) =>
      write([SESSIONS], (tx) => {
        tx.objectStore(SESSIONS).delete(id);
        return () => undefined;
      }),
    continueSession: (fromId, next) =>
      write<void, SkinNotFoundError>([SESSIONS], (tx, fail) => {
        const store = tx.objectStore(SESSIONS);
        onResult(store.getKey(fromId), (key) => {
          if (key === undefined) return fail(notFound(fromId));
          store.delete(fromId);
          store.add(next);
        });
        return () => undefined;
      }),
    commitSession: (input) =>
      write<
        StoredSkin,
        SkinNotFoundError | SkinChangedError | SkinLibraryError
      >(
        [SKINS, SESSIONS],
        (tx, fail) => {
          const skins = tx.objectStore(SKINS);
          let result: StoredSkin | undefined;
          onResult(skins.get(input.skinId), (value) => {
            if (value === undefined) return fail(notFound(input.skinId));
            const decoded = decodeSkin(value);
            if (decoded._tag === "None") return fail(libraryError("damaged"));
            const skin = decoded.value;
            if (skin.revision !== input.baseRevision && !input.replace)
              return fail(
                new SkinChangedError({
                  skin,
                  message: "This skin changed in another tab.",
                }),
              );
            const at = now();
            result = {
              ...skin,
              current: input.content,
              revision: skin.revision + 1,
              updatedAt: at,
              lastUsedAt: at,
            };
            skins.put(result);
            tx.objectStore(SESSIONS).delete(input.sessionId);
          });
          return () => result!;
        },
        "strict",
      ),
    createFromSession: (input) =>
      write(
        [SKINS, SESSIONS],
        (tx) => {
          const skin = create(input.skin, now());
          tx.objectStore(SKINS).add(skin);
          tx.objectStore(SESSIONS).delete(input.sessionId);
          return () => skin;
        },
        "strict",
      ),
    migrate: (input) =>
      write(
        [SKINS],
        (tx) => {
          const store = tx.objectStore(SKINS);
          let created = false;
          onResult(store.getKey(input.id), (key) => {
            if (key !== undefined) return;
            const skin = create(input.skin, now(), input.id);
            store.add({ ...skin, createdAt: input.createdAt });
            created = true;
          });
          return () => ({ created });
        },
        "strict",
      ),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  });
});

export function copyName(name: string) {
  return cleanSkinName(`${name} copy`);
}

export const skinLibraryLayer = (options: LibraryOptions) =>
  Layer.effect(SkinLibrary, makeSkinLibrary(options));
