import { useCallback, useEffect, useRef, useState } from "react";
import {
  addRecentColor,
  readRecentColors,
  RECENT_COLORS_KEY,
  writeRecentColors,
} from "@/lib/recent-colors";
import { browserStorage } from "@/lib/skin-draft";
import type { Rgba } from "@/lib/skin-paint";

/**
 * Recent paint colors that stay between editor visits in this browser. When
 * storage is blocked, full, or holds a newer format, the colors stay in
 * memory for this visit, without a message.
 */
export function useRecentColors() {
  const [colors, setColors] = useState<Rgba[]>([]);
  const current = useRef<Rgba[]>([]);
  /** False after a read finds a newer format, so this version keeps it. */
  const writable = useRef(true);

  useEffect(() => {
    const load = () => {
      const read = readRecentColors(browserStorage("localStorage"));
      writable.current = read.status !== "newer";
      if (read.status !== "found") return;
      current.current = read.colors;
      setColors(read.colors);
    };
    load();
    // Another tab added a color.
    const changed = (event: StorageEvent) => {
      if (event.key === RECENT_COLORS_KEY) load();
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);

  const add = useCallback((color: Rgba) => {
    const next = addRecentColor(current.current, color);
    current.current = next;
    setColors(next);
    if (writable.current)
      writeRecentColors(browserStorage("localStorage"), next);
  }, []);

  return [colors, add] as const;
}
