import type { AnyRouter } from "@tanstack/react-router";

/**
 * Each deploy replaces the hashed JavaScript files, so a tab opened before a
 * deploy can fail to load a lazy chunk, such as the 3D view. Load the new
 * build instead of showing an error.
 */
const reloadKey = "skinsrestorer:stale-chunk-reload";

/** Reload at most once in this window, so a broken deploy cannot loop. */
const RELOAD_WINDOW_MS = 60_000;

function shouldReloadForStaleChunk(lastReload: string | null, now: number) {
  const last = Number(lastReload);
  return (
    !lastReload || !Number.isFinite(last) || now - last >= RELOAD_WINDOW_MS
  );
}

interface StaleChunkEnvironment {
  /** Whether the page the reader asked for is still loading. */
  isNavigating: () => boolean;
  /** Load the current URL as a new document. */
  reload: () => void;
  storage: () => Pick<Storage, "getItem" | "setItem">;
  now: () => number;
}

/**
 * A chunk that fails while a page loads breaks the page the reader asked
 * for, so reload at once. Other failures, such as a hover preload, break
 * nothing yet, so wait and load the next page the reader opens as a new
 * document. Until then the importer gets the real error: a prevented error
 * would resolve the import to `undefined` and crash the caller instead.
 */
export function createStaleChunkHandler(environment: StaleChunkEnvironment) {
  let reloadOnNavigate = false;
  return {
    onPreloadError(event: Pick<Event, "preventDefault">) {
      if (!environment.isNavigating()) {
        reloadOnNavigate = true;
        return;
      }
      let last: string | null;
      const now = environment.now();
      try {
        const storage = environment.storage();
        last = storage.getItem(reloadKey);
        if (!shouldReloadForStaleChunk(last, now)) return;
        storage.setItem(reloadKey, String(now));
      } catch {
        // Without storage there is no loop guard, so let the error surface.
        return;
      }
      event.preventDefault();
      environment.reload();
    },
    /** The router has already moved the browser URL to the destination. */
    onBeforeNavigate(event: { pathChanged: boolean }) {
      if (!reloadOnNavigate || !event.pathChanged) return;
      reloadOnNavigate = false;
      environment.reload();
    },
  };
}

/**
 * Whether the router is loading the page the reader asked for. Hydration
 * loads the first page's chunks before any location resolves.
 */
export function isPageLoading(
  state: { status: string; resolvedLocation?: unknown } | undefined,
) {
  return !state || state.status === "pending" || !state.resolvedLocation;
}

let router: AnyRouter | undefined;
let stopWatching: (() => void) | undefined;

const handler = createStaleChunkHandler({
  isNavigating: () => isPageLoading(router?.state),
  reload: () => {
    window.location.reload();
  },
  storage: () => sessionStorage,
  now: () => Date.now(),
});

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    handler.onPreloadError(event);
  });
}

/** Let the handler tell navigations from hover preloads. */
export function watchNavigationsForStaleChunks(next: AnyRouter) {
  if (typeof window === "undefined") return;
  stopWatching?.();
  router = next;
  stopWatching = next.subscribe("onBeforeNavigate", (event) => {
    handler.onBeforeNavigate(event);
  });
}
