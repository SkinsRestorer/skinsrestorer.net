// Editor links can carry the skin in the query string or the fragment.
const textureParam = /([?&#]texture=)[^&#\s"'\\]*/giu;
// A Mojang texture URL names the skin by its hash in the path. Match it
// URL-encoded too, as it appears inside other links.
const texturePath =
  /(textures\.minecraft\.net(?:\/|%2F)texture(?:\/|%2F))[0-9a-f]+/giu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") return redactEditorParams(value);
  if (isRecord(value)) redactEditorParams(value);
  return value;
}

/**
 * Remove editor texture hashes and Mojang texture URLs from every string in
 * an analytics event, including page URLs inside session replay data. Objects and arrays change in place.
 */
export function redactEditorParams(value: string): string;
export function redactEditorParams<T extends object>(value: T): T;
export function redactEditorParams(value: string | object): string | object {
  if (typeof value === "string")
    return value
      .replaceAll(textureParam, "$1redacted")
      .replaceAll(texturePath, "$1redacted");
  if (Array.isArray(value)) {
    const items: unknown[] = value;
    for (let i = 0; i < items.length; i++) items[i] = redactValue(items[i]);
    return items;
  }
  if (isRecord(value)) {
    for (const key of Object.keys(value)) value[key] = redactValue(value[key]);
  }
  return value;
}
