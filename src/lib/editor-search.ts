/** Search parameters for the editor routes. Other values are dropped. */
export function editorHandoffSearch(search: Record<string, unknown>): {
  handoff?: string;
} {
  return typeof search.handoff === "string" && search.handoff
    ? { handoff: search.handoff }
    : {};
}

export function editorSearch(search: Record<string, unknown>): {
  texture?: string;
} {
  return typeof search.texture === "string" && search.texture
    ? { texture: search.texture }
    : {};
}
