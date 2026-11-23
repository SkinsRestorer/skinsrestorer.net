/**
 * The 3D view brings in three.js. The Studio loads it after hydration so
 * the upload form works sooner, and prefetches it once the page is idle.
 */
export const loadSkinView = () => import("./skin-view");
