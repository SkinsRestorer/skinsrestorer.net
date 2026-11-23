import type { MessageKey } from "@/lib/messages";

import { Effect } from "effect";
import { analytics } from "@/lib/analytics";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { runHttpEffect } from "@/lib/effect-http";
import { useLatestTask } from "@/lib/hooks/use-latest-task";
import { useSkinGallery } from "@/lib/hooks/use-skin-gallery";
import { useNotificationT, useT } from "@/lib/i18n-react";
import type { GallerySkin } from "@/lib/skin-gallery";
import { prepareSkinContent } from "@/lib/skin-library";
import { withLibrary, type LibraryClient } from "@/lib/skin-library-client";
import type { SkinSelectionStore } from "@/lib/skin-selection";
import { loadTextureEffect } from "@/lib/skin-texture";
import type { SkinSource, StudioSearch } from "@/lib/studio";

/**
 * Open the public skins that the URL names: a gallery skin or a texture
 * link. Each read is the latest task; a newer choice cancels it. Only reads
 * that the URL started end when the URL drops them.
 */
export function useStudioUrlImports(options: {
  readonly search: StudioSearch;
  readonly source: SkinSource;
  readonly store: SkinSelectionStore;
  readonly client: LibraryClient | undefined;
  /** A gallery skin opened, so a phone drawer can close. */
  readonly onGalleryOpened: () => void;
}) {
  const { search, store } = options;
  const t = useT();
  const notify = useNotificationT();
  const task = useLatestTask();
  /** Only URL-owned reads are cancelled when their reference is removed. */
  const urlImport = useRef(false);
  /** A gallery skin from the URL that waits for the catalog. */
  const [wantedGallery, setWantedGallery] = useState<string>();
  const [pendingGallery, setPendingGallery] = useState<string>();
  const [galleryError, setGalleryError] = useState<MessageKey>();
  const gallery = useSkinGallery(
    options.source === "gallery" || wantedGallery !== undefined,
  );

  const cancelImport = () => {
    urlImport.current = false;
    setWantedGallery(undefined);
    setPendingGallery(undefined);
    setGalleryError(undefined);
    task.cancel();
  };

  /**
   * Download a trusted texture, keep it in the library, and select it.
   * `onOpened` runs only once the skin is selected.
   */
  const importTexture = (
    reference: string,
    fromUrl = false,
    onOpened?: () => void,
  ) => {
    cancelImport();
    urlImport.current = fromUrl;
    void task.run(
      async (signal) => {
        const result = await runHttpEffect(
          loadTextureEffect(reference),
          signal,
        );
        const png = new Blob([result.bytes], {
          type: "image/png",
        });
        const name = notify("library.textureName", {
          hash: result.hash.slice(0, 8),
        });
        const client = options.client;
        if (!client) return { png, name, skin: undefined };
        try {
          const { skin } = await client.run(
            Effect.gen(function* () {
              const content = yield* prepareSkinContent(png);
              return yield* withLibrary((l) =>
                l.add(
                  {
                    name,
                    content,
                    source: { kind: "texture", textureHash: result.hash },
                  },
                  { dedupe: true },
                ),
              );
            }),
            signal,
          );
          return { png, name, skin };
        } catch {
          return { png, name, skin: undefined };
        }
      },
      ({ png, name, skin }) => {
        if (skin) store.selectSkin(skin);
        else
          store.select(new File([png], `${name}.png`, { type: "image/png" }), {
            origin: "file",
            name,
          });
        onOpened?.();
        void analytics.capture("editor_opened", { source: "texture_url" });
      },
      (cause) => {
        toast.error(t.error(cause));
      },
    );
  };

  const importGallery = (skin: GallerySkin) => {
    cancelImport();
    urlImport.current = true;
    setPendingGallery(skin.id);
    void task.run(
      (signal) => runHttpEffect(loadTextureEffect(skin.textureUrl), signal),
      (result) => {
        setPendingGallery(undefined);
        options.onGalleryOpened();
        store.select(
          // Named like library skins, so the default custom skin name
          // follows the gallery name.
          new File([result.bytes], `${skin.name}.png`, { type: "image/png" }),
          {
            origin: "gallery",
            galleryId: skin.id,
            name: skin.name,
            variant: skin.variant,
          },
        );
      },
      () => {
        setPendingGallery(undefined);
        setGalleryError("studio.gallerySkinCouldNotOpenedTryAgain");
      },
    );
  };

  /** A gallery skin named by the URL, once the catalog is ready. */
  const openGallerySkin = (id: string) => {
    if (gallery.state.status !== "ready") {
      cancelImport();
      urlImport.current = true;
      setWantedGallery(id);
      return;
    }
    const skin = gallery.state.skins.find((entry) => entry.id === id);
    if (skin) importGallery(skin);
    else {
      cancelImport();
      urlImport.current = true;
      setGalleryError("studio.skinNoLongerGallery");
    }
  };

  // Only a changed reference starts an import. Clearing it, or returning to
  // an entry for the same skin, keeps the current selection.
  const appliedReference = useRef<StudioSearch>({});
  useEffect(() => {
    const before = appliedReference.current;
    appliedReference.current = search;
    if (search.texture) {
      if (search.texture !== before.texture)
        importTexture(search.texture, true);
    } else if (search.skin) {
      if (search.skin !== before.skin) openGallerySkin(search.skin);
    } else if (urlImport.current) cancelImport();
    // The URL owns these imports; newer choices cancel them.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [search.texture, search.skin]);

  useEffect(() => {
    if (!wantedGallery || gallery.state.status !== "ready") return;
    // oxlint-disable-next-line react-hooks-js/set-state-in-effect -- A pending URL import resumes when the external catalog arrives.
    openGallerySkin(wantedGallery);
    // Only the catalog arriving resolves the waiting link.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [gallery.state, wantedGallery]);

  return {
    gallery,
    /** Runs one import at a time; a newer run replaces the older one. */
    task,
    wantedGallery,
    pendingGallery,
    galleryError,
    clearGalleryError: () => {
      setGalleryError(undefined);
    },
    cancelImport,
    importTexture,
    importGallery,
  };
}
