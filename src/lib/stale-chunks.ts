/**
 * Each deploy replaces the hashed JavaScript files, so a tab opened before a
 * deploy can fail to load a lazy chunk, such as the 3D view. Reload once to
 * get the new build instead of showing an error.
 */
const reloadKey = "skinsrestorer:stale-chunk-reload";

/** Reload at most once in this window, so a broken deploy cannot loop. */
const RELOAD_WINDOW_MS = 60_000;

export function shouldReloadForStaleChunk(
  lastReload: string | null,
  now: number,
) {
  const last = Number(lastReload);
  return (
    !lastReload || !Number.isFinite(last) || now - last >= RELOAD_WINDOW_MS
  );
}

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    let last: string | null = null;
    try {
      last = sessionStorage.getItem(reloadKey);
    } catch {
      // Without storage there is no loop guard, so let the error surface.
      return;
    }
    const now = Date.now();
    if (!shouldReloadForStaleChunk(last, now)) return;
    try {
      sessionStorage.setItem(reloadKey, String(now));
    } catch {
      return;
    }
    event.preventDefault();
    window.location.reload();
  });
}
