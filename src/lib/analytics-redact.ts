const textureParam = /([?&](?:texture|handoff)=)[^&#\s"'\\]*/gi;

/**
 * Remove editor texture hashes and handoff ids from every string in an
 * analytics event, including page URLs inside session replay data.
 */
export function redactEditorParams<T>(value: T): T {
  if (typeof value === "string")
    return value.replace(textureParam, "$1redacted") as T;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++)
      value[i] = redactEditorParams(value[i]);
    return value;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record))
      record[key] = redactEditorParams(record[key]);
  }
  return value;
}
