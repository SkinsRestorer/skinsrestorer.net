import type { SkinViewer } from "skinview3d";

type PreviewViewer = Pick<SkinViewer, "loadSkin" | "loadCape" | "dispose">;

/** Own both the viewer and its asynchronous texture loads. */
export function startSkinPreview<V extends PreviewViewer>(
  create: () => V,
  textures: { skin: string; cape?: string },
  ready: (viewer: V) => void,
  failed: () => void,
): () => void {
  let active = true;
  let viewer: V | undefined;
  const stop = () => {
    active = false;
    viewer?.dispose();
    viewer = undefined;
  };
  const fail = () => {
    if (!active) return;
    stop();
    failed();
  };
  try {
    viewer = create();
    // Attaching handlers immediately also covers browser image error Events.
    void viewer.loadSkin(textures.skin).catch(fail);
    if (textures.cape) void viewer.loadCape(textures.cape).catch(fail);
    ready(viewer);
  } catch {
    fail();
  }
  return stop;
}
