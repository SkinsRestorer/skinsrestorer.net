import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAsRef } from "@/hooks/use-as-ref";
import { LocationWrite } from "@/lib/location-write";
import {
  MAX_GALLERY_QUERY,
  skinSource,
  studioSearch,
  withoutSkinReference,
  type SkinSource,
  type StudioSearch,
} from "@/lib/studio";

/** Typed gallery search reaches the URL after this pause. */
const QUERY_WRITE_MS = 400;

/**
 * The public Studio state in the URL: the list shown, the gallery search,
 * and the skin reference. Library skins and the API key never appear here.
 */
export function useStudioSearch(search: StudioSearch) {
  const router = useRouter();
  const navigate = useNavigate();
  const source = skinSource(search);

  /**
   * Change the public URL state. A new selection adds a history entry;
   * everything else replaces the current one and keeps its editor mark.
   * These navigations never replace unsaved work, so they skip the blocker.
   */
  const updateSearch = (
    update: (search: StudioSearch) => StudioSearch,
    history: "push" | "replace" = "replace",
  ) =>
    navigate({
      to: ".",
      search: (prev: StudioSearch) => studioSearch({ ...update(prev) }),
      replace: history === "replace",
      state: history === "replace" ? (prev) => prev : {},
      resetScroll: false,
      ignoreBlocker: true,
    });

  /** A local skin is selected: the URL no longer names a public skin. */
  const dropSkinReference = () => {
    if (search.skin || search.texture) void updateSearch(withoutSkinReference);
  };

  const updateSearchRef = useAsRef(updateSearch);

  // Gallery search: the input and filter follow each key press at once, the
  // URL after a pause. Back, Forward, and links bring their own text.
  const [query, setQuery] = useState(search.q ?? "");
  const writtenQuery = useRef(search.q);
  const historyIndex = useRouterState({
    select: (routerState) => routerState.location.state.__TSR_index,
  });
  const queryLocation = JSON.stringify([
    historyIndex,
    source,
    search.skin,
    search.texture,
  ]);
  const previousQueryLocation = useRef(queryLocation);
  const queryWrite = useRef<LocationWrite<string | undefined>>(null);
  useEffect(() => {
    const writer = new LocationWrite<string | undefined>(
      () =>
        router.history.location.state.__TSR_key ?? router.history.location.href,
      (q) => {
        writtenQuery.current = q;
        void updateSearchRef.current((prev) => ({ ...prev, q }));
      },
      QUERY_WRITE_MS,
    );
    queryWrite.current = writer;
    return () => {
      writer.cancel();
      queryWrite.current = null;
    };
  }, [router, updateSearchRef]);
  useEffect(() => {
    const moved = previousQueryLocation.current !== queryLocation;
    previousQueryLocation.current = queryLocation;
    if (!moved && search.q === writtenQuery.current) return;
    writtenQuery.current = search.q;
    queryWrite.current?.cancel();
    setQuery(search.q ?? "");
  }, [search.q, queryLocation]);

  const changeQuery = (value: string) => {
    setQuery(value);
    const q = value.trim().slice(0, MAX_GALLERY_QUERY).trim() || undefined;
    queryWrite.current?.schedule(q);
  };
  const changeSource = (next: SkinSource) => {
    queryWrite.current?.cancel();
    const q =
      next === "gallery" ? query.trim().slice(0, MAX_GALLERY_QUERY) : "";
    writtenQuery.current = q || undefined;
    void updateSearch((prev) => ({
      ...prev,
      source: next,
      q: q || undefined,
    }));
  };
  /** A navigation that carries the typed text itself replaces the write. */
  const cancelQueryWrite = () => {
    queryWrite.current?.cancel();
  };

  return {
    source,
    query,
    updateSearch,
    dropSkinReference,
    changeQuery,
    changeSource,
    cancelQueryWrite,
  };
}
