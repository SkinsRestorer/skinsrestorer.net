const textureParam = /([?&](?:texture|handoff)=)[^&#\s"'\\]*/giu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") return redactEditorParams(value);
  if (isRecord(value)) redactEditorParams(value);
  return value;
}

/**
 * Remove editor texture hashes and handoff ids from every string in an
 * analytics event, including page URLs inside session replay data. Objects
 * and arrays change in place.
 */
export function redactEditorParams(value: string): string;
export function redactEditorParams<T extends object>(value: T): T;
export function redactEditorParams(value: string | object): string | object {
  if (typeof value === "string")
    return value.replaceAll(textureParam, "$1redacted");
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
