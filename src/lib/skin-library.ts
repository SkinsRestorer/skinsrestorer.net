import { locales, type Locale } from "./i18n";
import {
  messageFields,
  errorMessage,
  message,
  translate,
  type Message,
  type MessageKey,
} from "./messages";
import { messageKeySchema, messageValuesSchema } from "./messages/schema";
import { Context, Effect, Layer, Schema } from "effect";
import { PngError, readPngSize } from "./png";
import { validateSkinDimensions, type SkinVariant } from "./skin";
import { importSkinPng, MAX_SKIN_FILE_BYTES } from "./skin-document";
import { required } from "./utils";

/**
 * Skins kept in this browser. One IndexedDB database holds two stores:
 * `skins` (the original and current PNG of each skin) and `sessions` (unsaved
 * editor work). Nothing here uses the network.
 */
export const LIBRARY_DB = "skinsrestorer-skins";
const LIBRARY_VERSION = 1;
export const LIBRARY_CHANNEL = "skinsrestorer-skins";
export const MAX_SKIN_NAME_LENGTH = 80;
const SKINS = "skins";
const SESSIONS = "sessions";

const libraryFailureSchema = Schema.Literals([
  "unavailable",
  "full",
  "newer",
  "closed",
  "invalid",
  "damaged",
  "failed",
]);
export type LibraryFailure = typeof libraryFailureSchema.Type;

// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is a class factory.
export class SkinLibraryError extends Schema.TaggedError<
  SkinLibraryError,
  { readonly brand: unique symbol }
>()("SkinLibraryError", {
  reason: libraryFailureSchema,
  message: Schema.String,
  messageKey: Schema.optional(messageKeySchema),
  messageValues: Schema.optional(messageValuesSchema),
  cause: Schema.optional(Schema.Unknown),
}) {}

// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is a class factory.
export class SkinNotFoundError extends Schema.TaggedError<
  SkinNotFoundError,
  { readonly brand: unique symbol }
>()("SkinNotFoundError", {
  id: Schema.String,
  message: Schema.String,
  messageKey: Schema.optional(messageKeySchema),
  messageValues: Schema.optional(messageValuesSchema),
}) {}

const failureMessages: Record<LibraryFailure, MessageKey> = {
  unavailable: "library.browserDoesNotLetSiteKeepSkins",
  full: "library.browserStorageSiteFull",
  newer: "library.newerVersionSiteChangedSkinsKeptBrowser",
  closed: "library.anotherTabUpdatedSkinsKeptBrowserReload",
  invalid: "library.fileNotSkinPng",
  damaged: "library.keptSkinCouldNotRead",
  failed: "library.browserCouldNotSaveSkin",
};

export function libraryError(
  reason: LibraryFailure,
  cause?: unknown,
  detail: Message = message(failureMessages[reason]),
) {
  return SkinLibraryError.make({
    reason,
    ...(typeof detail === "string"
      ? { message: detail }
      : messageFields(detail.key, detail.values)),
    cause,
  });
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
  width: Schema.Finite,
  height: Schema.Finite,
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
  revision: Schema.Finite,
  source: sourceSchema,
  createdAt: Schema.Finite,
  updatedAt: Schema.Finite,
  lastUsedAt: Schema.Finite,
});
const sessionSchema = Schema.Struct({
  id: Schema.String,
  skinId: Schema.optional(Schema.String),
  baseRevision: Schema.optional(Schema.Finite),
  name: Schema.String,
  png: Schema.instanceOf(Blob),
  variant: variantSchema,
  updatedAt: Schema.Finite,
});

export type SkinContent = typeof contentSchema.Type;
type SkinSource = typeof sourceSchema.Type;
export type StoredSkin = typeof skinSchema.Type;

/** Another tab saved this skin after the edit session started. */
// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is a class factory.
export class SkinChangedError extends Schema.TaggedError<
  SkinChangedError,
  { readonly brand: unique symbol }
>()("SkinChangedError", {
  skin: skinSchema,
  message: Schema.String,
  messageKey: Schema.optional(messageKeySchema),
  messageValues: Schema.optional(messageValuesSchema),
}) {}

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

/**
 * `changed` follows a change to skins, which can also remove drafts.
 * `sessions` follows a change to drafts only, such as an autosave, so
 * listeners that show skins can ignore it. `closed` means the database closed.
 */
export interface LibraryEvent {
  readonly type: "changed" | "sessions" | "closed";
}

export function cleanSkinName(name: string, fallback = "Skin") {
  const clean = name
    .replace(/\.png$/iu, "")
    .replaceAll(/\s+/gu, " ")
    .trim()
    .slice(0, MAX_SKIN_NAME_LENGTH);
  return clean || fallback;
}

async function sha256(bytes: Uint8Array<ArrayBuffer>) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
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
      message("common.fileLargerThan5Mb"),
    );
  const bytes = yield* Effect.tryPromise({
    try: async () => new Uint8Array(await source.arrayBuffer()),
    catch: (cause) =>
      libraryError("invalid", cause, message("library.fileCouldNotRead")),
  });
  const size = yield* Effect.try({
    try: () => {
      const dimensions = readPngSize(bytes);
      validateSkinDimensions(dimensions.width, dimensions.height);
      return dimensions;
    },
    catch: (cause) =>
      libraryError(
        "invalid",
        cause,
        cause instanceof Error && !(cause instanceof PngError)
          ? errorMessage(cause)
          : message(failureMessages.invalid),
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
          cause instanceof Error
            ? errorMessage(cause)
            : message(failureMessages.invalid),
        ),
    });
    // A copy in an ArrayBuffer, which the digest needs. The bytes are equal.
    const pixels = new Uint8Array(imported.document.pixels);
    pixelKey = `pixels:${yield* Effect.promise(() => sha256(pixels))}`;
    detected = imported.document.variant;
  }
  const model = variant ?? detected;
  return {
    png: new Blob([bytes], { type: "image/png" }),
    hash,
    pixelKey,
    key: `${pixelKey}:${model}`,
    variant: model,
    width: size.width,
    height: size.height,
  } satisfies SkinContent;
});

function withVariant(content: SkinContent, variant: SkinVariant): SkinContent {
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
    /**
     * Always a new skin, even when the pixels are the same. `locale` names
     * the copy.
     */
    readonly duplicate: (
      id: string,
      locale?: Locale,
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
    /**
     * Save editor work as a new skin and delete its session. With
     * `requireSession`, a missing session fails and nothing is created.
     */
    readonly createFromSession: (input: {
      readonly sessionId: string;
      readonly skin: NewSkin;
      readonly requireSession?: boolean;
    }) => Effect.Effect<StoredSkin, SkinLibraryError | SkinNotFoundError>;
    /** Add a migrated draft under a fixed id. A second call does nothing. */
    readonly migrate: (input: {
      readonly id: string;
      readonly skin: NewSkin;
      readonly createdAt: number;
    }) => Effect.Effect<{ readonly created: boolean }, SkinLibraryError>;
    readonly subscribe: (listener: (event: LibraryEvent) => void) => () => void;
  }
>()("skinsrestorer.net/lib/skin-library/SkinLibrary") {}

/** The parts of BroadcastChannel the library uses. */
export interface LibraryChannel {
  postMessage(message: unknown): void;
  addEventListener(
    type: "message",
    listener: (event: { readonly data?: unknown }) => void,
  ): void;
  close(): void;
}

export interface LibraryOptions {
  readonly factory: Pick<IDBFactory, "open">;
  readonly name?: string;
  readonly channel?: () => LibraryChannel | undefined;
  readonly now?: () => number;
  readonly id?: () => string;
  readonly openTimeoutMs?: number;
}

/** Open the database. A newer version on disk is reported, never replaced. */
function openDatabase(
  factory: Pick<IDBFactory, "open">,
  name: string,
  timeoutMs: number,
) {
  return Effect.callback<IDBDatabase, SkinLibraryError>(
    (resume): Effect.Effect<void> | undefined => {
      let request: IDBOpenDBRequest;
      let settled = false;
      try {
        request = factory.open(name, LIBRARY_VERSION);
      } catch (cause) {
        resume(Effect.fail(libraryError("unavailable", cause)));
        return undefined;
      }
      request.addEventListener("upgradeneeded", (event) => {
        const db = request.result;
        if (event.oldVersion < 1) {
          const skins = db.createObjectStore(SKINS, { keyPath: "id" });
          skins.createIndex("key", "current.key");
          skins.createIndex("lastUsedAt", "lastUsedAt");
          const sessions = db.createObjectStore(SESSIONS, { keyPath: "id" });
          sessions.createIndex("skinId", "skinId");
        }
      });
      const opened = () => {
        settled = true;
        resume(Effect.succeed(request.result));
      };
      const failed = (event: Event) => {
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
      request.addEventListener("success", opened);
      request.addEventListener("error", failed);
      return Effect.sync(() => {
        if (settled) return;
        // The open may still finish after cancellation. Close it then.
        request.removeEventListener("success", opened);
        request.removeEventListener("error", failed);
        request.addEventListener("success", () => {
          request.result.close();
        });
        request.addEventListener("error", (event) => {
          event.preventDefault();
        });
      });
    },
  ).pipe(
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
  stores: string[],
  mode: IDBTransactionMode,
  body: (tx: IDBTransaction, fail: (error: E) => void) => () => A,
  durability: "default" | "strict" = "default",
) {
  return Effect.callback<A, E | SkinLibraryError>(
    (resume): Effect.Effect<void> | undefined => {
      let tx: IDBTransaction;
      let done = false;
      let failure: { readonly error: E } | undefined;
      const finish = (effect: Effect.Effect<A, E | SkinLibraryError>) => {
        if (done) return;
        done = true;
        resume(effect);
      };
      try {
        tx = db().transaction(stores, mode, { durability });
      } catch (cause) {
        finish(Effect.fail(storageError(cause)));
        return undefined;
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
        return undefined;
      }
      tx.addEventListener("complete", () => {
        finish(Effect.sync(read));
      });
      tx.addEventListener("abort", () => {
        finish(Effect.fail(failure ? failure.error : storageError(tx.error)));
      });
      return Effect.sync(() => {
        if (done) return;
        done = true;
        try {
          tx.abort();
        } catch {
          // The transaction already finished.
        }
      });
    },
  );
}

/** The `id` key path of a stored record, also when the record is damaged. */
function recordKey(value: unknown): string | number | undefined {
  if (typeof value !== "object" || value === null || !("id" in value))
    return undefined;
  const { id } = value;
  return typeof id === "string" || typeof id === "number" ? id : undefined;
}

function onResult<T>(request: IDBRequest<T>, handle: (value: T) => void) {
  request.onsuccess = () => {
    handle(request.result);
  };
}

const notFound = (id: string) =>
  SkinNotFoundError.make({
    id,
    ...messageFields("library.skinNoLongerKeptBrowser"),
  });

const makeSkinLibrary = Effect.fn("SkinLibrary.make")(function* (
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
    (db) =>
      Effect.sync(() => {
        db.close();
      }),
  );
  // A newer page wants to upgrade the database. Close this connection so it
  // is not blocked; later calls fail with a "reload" message.
  database.onversionchange = () => {
    database.close();
    emit({ type: "closed" });
  };
  const channel = yield* Effect.acquireRelease(
    Effect.sync(() => {
      const opened = options.channel?.();
      opened?.addEventListener("message", (event) => {
        // Unknown messages, for example from an older page, mean any change.
        const data: unknown = event.data;
        const sessionsOnly =
          typeof data === "object" &&
          data !== null &&
          "type" in data &&
          data.type === "sessions";
        emit({ type: sessionsOnly ? "sessions" : "changed" });
      });
      return opened;
    }),
    (opened) => Effect.sync(() => opened?.close()),
  );
  const changed = (type: "changed" | "sessions") =>
    Effect.sync(() => {
      emit({ type });
      try {
        // oxlint-disable-next-line unicorn/require-post-message-target-origin -- BroadcastChannel has no target origin.
        channel?.postMessage({ type });
      } catch {
        // Other tabs refresh when they next read the list.
      }
    });
  const db = () => database;

  const read = <A, E = never>(
    stores: string[],
    body: (tx: IDBTransaction, fail: (error: E) => void) => () => A,
  ) => transaction<A, E>(db, stores, "readonly", body);
  const write = <A, E = never>(
    stores: string[],
    body: (tx: IDBTransaction, fail: (error: E) => void) => () => A,
    durability: "default" | "strict" = "default",
  ) =>
    transaction<A, E>(db, stores, "readwrite", body, durability).pipe(
      Effect.tap(() => changed("changed")),
    );
  /**
   * Write drafts only. Autosave does this often, so it tells listeners
   * with a `sessions` event that skin lists can ignore.
   */
  const writeSessions = <A, E = never>(
    body: (tx: IDBTransaction, fail: (error: E) => void) => () => A,
  ) =>
    transaction<A, E>(db, [SESSIONS], "readwrite", body).pipe(
      Effect.tap(() => changed("sessions")),
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
          if (value === undefined) {
            fail(notFound(id));
            return;
          }
          const skin = decodeSkin(value);
          if (skin._tag === "None") {
            fail(libraryError("damaged"));
            return;
          }
          result = change(skin.value, now());
          store.put(result);
        });
        return () => required(result, "transaction result");
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
      onResult(tx.objectStore(SKINS).getAll(), (values: readonly unknown[]) => {
        for (const value of values) {
          const skin = decodeSkin(value);
          const key = recordKey(value);
          if (skin._tag === "Some") listing.skins.push(skin.value);
          else if (key !== undefined)
            listing.damaged.push({ store: "skins", key });
        }
      });
      onResult(
        tx.objectStore(SESSIONS).getAll(),
        (values: readonly unknown[]) => {
          for (const value of values) {
            const session = decodeSession(value);
            const key = recordKey(value);
            if (session._tag === "Some") listing.sessions.push(session.value);
            else if (key !== undefined)
              listing.damaged.push({ store: "sessions", key });
          }
        },
      );
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
        Effect.filterOrFail(
          (skin): skin is StoredSkin => skin !== undefined,
          () => notFound(id),
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
              .toSorted((a, b) => b.lastUsedAt - a.lastUsedAt)[0];
            if (!match) {
              insert();
              return;
            }
            const used = { ...match, lastUsedAt: at };
            store.put(used);
            result = { skin: used, created: false };
          });
        return () => required(result, "transaction result");
      }),
    touch: (id) =>
      write([SKINS], (tx) => {
        const store = tx.objectStore(SKINS);
        onResult(store.get(id), (value) => {
          const skin = decodeSkin(value);
          if (skin._tag === "Some")
            store.put({ ...skin.value, lastUsedAt: now() });
        });
        return () => {};
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
      }).pipe(
        Effect.map((skin) => ({
          skin,
          previous: required(previous, "previous content"),
        })),
      );
    },
    duplicate: (id, locale) =>
      write<StoredSkin, SkinNotFoundError | SkinLibraryError>(
        [SKINS],
        (tx, fail) => {
          const store = tx.objectStore(SKINS);
          let result: StoredSkin | undefined;
          onResult(store.get(id), (value) => {
            if (value === undefined) {
              fail(notFound(id));
              return;
            }
            const skin = decodeSkin(value);
            if (skin._tag === "None") {
              fail(libraryError("damaged"));
              return;
            }
            result = create(
              {
                name: copyName(skin.value.name, locale),
                content: skin.value.current,
                source: { kind: "copy", copiedFrom: id },
              },
              now(),
            );
            store.add(result);
          });
          return () => required(result, "transaction result");
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
            if (value === undefined) {
              fail(notFound(id));
              return;
            }
            const decoded = decodeSkin(value);
            if (decoded._tag === "None") {
              fail(libraryError("damaged"));
              return;
            }
            skin = decoded.value;
            skins.delete(id);
          });
          onResult(
            sessions.index("skinId").getAll(id),
            (values: readonly unknown[]) => {
              for (const value of values) {
                const session = decodeSession(value);
                const key = recordKey(value);
                if (session._tag === "Some")
                  removedSessions.push(session.value);
                if (key !== undefined) sessions.delete(key);
              }
            },
          );
          return () => ({
            skin: required(skin, "removed skin"),
            sessions: removedSessions,
          });
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
        return () => {};
      }),
    removeDamaged: (record) =>
      write([record.store], (tx) => {
        tx.objectStore(record.store).delete(record.key);
        return () => {};
      }),
    saveSession: (session) =>
      writeSessions((tx) => {
        tx.objectStore(SESSIONS).put(session);
        return () => {};
      }),
    deleteSession: (id) =>
      writeSessions((tx) => {
        tx.objectStore(SESSIONS).delete(id);
        return () => {};
      }),
    continueSession: (fromId, next) =>
      writeSessions<undefined, SkinNotFoundError>((tx, fail) => {
        const store = tx.objectStore(SESSIONS);
        onResult(store.getKey(fromId), (key) => {
          if (key === undefined) {
            fail(notFound(fromId));
            return;
          }
          store.delete(fromId);
          store.add(next);
        });
        return (): undefined => {};
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
            if (value === undefined) {
              fail(notFound(input.skinId));
              return;
            }
            const decoded = decodeSkin(value);
            if (decoded._tag === "None") {
              fail(libraryError("damaged"));
              return;
            }
            const skin = decoded.value;
            if (skin.revision !== input.baseRevision && !input.replace) {
              fail(
                SkinChangedError.make({
                  skin,
                  ...messageFields("library.skinChangedAnotherTab"),
                }),
              );
              return;
            }
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
          return () => required(result, "transaction result");
        },
        "strict",
      ),
    createFromSession: (input) =>
      write<StoredSkin, SkinNotFoundError>(
        [SKINS, SESSIONS],
        (tx, fail) => {
          const skin = create(input.skin, now());
          const sessions = tx.objectStore(SESSIONS);
          const insert = () => {
            tx.objectStore(SKINS).add(skin);
            sessions.delete(input.sessionId);
          };
          if (!input.requireSession) insert();
          else
            onResult(sessions.getKey(input.sessionId), (key) => {
              if (key === undefined) fail(notFound(input.sessionId));
              else insert();
            });
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

/** The two copy name patterns of one language, with `{name}` and `{number}`. */
interface CopyPattern {
  readonly first: string;
  readonly numbered: string;
}

function copyPattern(locale: Locale): CopyPattern {
  return {
    // Without placeholder values, the templates stay as they are.
    first: translate(locale, "library.copyName"),
    numbered: translate(locale, "library.copyNameNumbered"),
  };
}

const escapeRegExp = (text: string) =>
  text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

/** Read "Harbor copy 2" as base "Harbor" and number 2, or undefined. */
function parseCopyName(
  name: string,
  pattern: CopyPattern,
): { base: string; number: number } | undefined {
  for (const [template, numbered] of [
    [pattern.numbered, true],
    [pattern.first, false],
  ] as const) {
    const source = escapeRegExp(template)
      .replace(String.raw`\{name\}`, "(?<name>.+?)")
      .replace(String.raw`\{number\}`, String.raw`(?<number>\d+)`);
    const groups = new RegExp(`^${source}$`, "u").exec(name)?.groups;
    if (groups?.["name"])
      return {
        base: groups["name"],
        number: numbered ? Number(groups["number"]) : 1,
      };
  }
  return undefined;
}

/**
 * Name a copy in the visitor's language: "Harbor" becomes "Harbor copy",
 * then "Harbor copy 2". A copy name from English or another loaded language
 * counts on in this one. The suffix stays when a long name is shortened, so a copy never takes
 * the exact name of its source.
 */
export function copyName(name: string, locale: Locale = "en") {
  const clean = cleanSkinName(name);
  const pattern = copyPattern(locale);
  const parsed =
    parseCopyName(clean, pattern) ??
    locales
      .filter((other) => other !== locale)
      .map((other) => parseCopyName(clean, copyPattern(other)))
      .find((match) => match !== undefined);
  const base = parsed?.base ?? clean;
  const template = parsed ? pattern.numbered : pattern.first;
  const number = String((parsed?.number ?? 0) + 1);
  const fill = (value: string) =>
    template.replace("{name}", () => value).replace("{number}", number);
  const room = MAX_SKIN_NAME_LENGTH - fill("").length;
  // Do not cut a character that takes two UTF-16 units in half.
  const cut = base.slice(0, room).replace(/[\uD800-\uDBFF]$/u, "");
  return fill(cut.trimEnd());
}

/** Names Windows reserves for devices, with or without an extension. */
const RESERVED_FILE_NAME =
  /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(\..*)?$/iu;

/**
 * A download file name for a skin. Characters that Windows, macOS, or Linux
 * reject become "_", and names Windows reserves get a "_" suffix. Letters in
 * any script stay as they are.
 */
export function skinFileName(name: string) {
  const clean = name
    .normalize("NFC")
    // Control characters and text direction overrides can disguise a name.
    .replaceAll(/[\p{Cc}\u202A-\u202E\u2066-\u2069]/gu, "")
    .replaceAll(/[<>:"/\\|?*]/gu, "_")
    .replaceAll(/\s+/gu, " ")
    .trim()
    // Windows drops trailing dots and spaces.
    .replace(/[. ]+$/u, "");
  const safe = RESERVED_FILE_NAME.test(clean) ? `${clean}_` : clean;
  return `${safe || "skin"}.png`;
}

export const skinLibraryLayer = (options: LibraryOptions) =>
  Layer.effect(SkinLibrary, makeSkinLibrary(options));
