import type { KeyValueStorage } from "./skin-draft";
import type { Rgba } from "./skin-paint";

/** The editor shows this many recent colors. */
export const RECENT_COLOR_LIMIT = 8;
export const RECENT_COLORS_KEY = "skinsrestorer:editor-recent-colors";
const VERSION = 1;

export type RecentColorsRead =
  | { readonly status: "found"; readonly colors: Rgba[] }
  | { readonly status: "none" | "corrupt" | "newer" | "unavailable" };

function sameColor(a: Rgba, b: Rgba) {
  return a.every((value, i) => value === b[i]);
}

function isRgba(value: unknown): value is Rgba {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every(
      (channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255,
    )
  );
}

/** Put a color first. A color that is already in the list moves to the front. */
export function addRecentColor(list: readonly Rgba[], color: Rgba): Rgba[] {
  return [color, ...list.filter((c) => !sameColor(c, color))].slice(
    0,
    RECENT_COLOR_LIMIT,
  );
}

/**
 * Read the stored recent colors. Invalid entries make the whole value
 * corrupt. A value from a newer version is left alone.
 */
export function readRecentColors(
  storage: KeyValueStorage | undefined,
): RecentColorsRead {
  if (!storage) return { status: "unavailable" };
  let text: string | null;
  try {
    text = storage.getItem(RECENT_COLORS_KEY);
  } catch {
    return { status: "unavailable" };
  }
  if (text === null) return { status: "none" };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { status: "corrupt" };
  }
  if (!value || typeof value !== "object") return { status: "corrupt" };
  const { version, colors } = value as { version?: unknown; colors?: unknown };
  if (typeof version === "number" && version > VERSION)
    return { status: "newer" };
  if (version !== VERSION || !Array.isArray(colors) || !colors.every(isRgba))
    return { status: "corrupt" };
  let list: Rgba[] = [];
  for (const color of [...colors].reverse())
    list = addRecentColor(list, [color[0], color[1], color[2], color[3]]);
  return { status: "found", colors: list };
}

/**
 * Store the recent colors. It returns false when the browser blocks storage
 * or the storage is full; the editor then keeps the colors in memory.
 */
export function writeRecentColors(
  storage: KeyValueStorage | undefined,
  colors: readonly Rgba[],
) {
  if (!storage) return false;
  try {
    storage.setItem(
      RECENT_COLORS_KEY,
      JSON.stringify({
        version: VERSION,
        colors: colors.slice(0, RECENT_COLOR_LIMIT),
      }),
    );
    return true;
  } catch {
    return false;
  }
}
