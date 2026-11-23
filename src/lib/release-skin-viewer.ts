import type { SkinViewer } from "skinview3d";
import { Mesh, type BufferGeometry, type Material, type Object3D } from "three";

function isMesh(object: Object3D): object is Mesh {
  return object instanceof Mesh;
}

/**
 * Dispose a skinview3d viewer and free its GPU memory and WebGL context.
 * `SkinViewer.dispose()` frees only the renderer state, so the model buffers,
 * the post-processing targets, and the context stay alive until garbage
 * collection, and the browser drops old contexts when too many stay open.
 *
 * Remove your own `webglcontextlost` listeners first: losing the context
 * fires that event.
 */
export function releaseSkinViewer(viewer: SkinViewer) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  viewer.scene.traverse((object) => {
    if (!isMesh(object)) return;
    const { geometry, material } = object;
    geometries.add(geometry);
    for (const each of Array.isArray(material) ? material : [material])
      materials.add(each);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  viewer.composer.dispose();
  viewer.fxaaPass.dispose();
  const canvas = viewer.canvas;
  viewer.dispose();
  // A remount can build a new viewer on the same canvas, which reuses its
  // context. Lose the context only once the canvas has left the page.
  queueMicrotask(() => {
    if (!canvas.isConnected) viewer.renderer.forceContextLoss();
  });
}
