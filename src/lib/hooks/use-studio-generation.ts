import { useEffect, useState, useSyncExternalStore } from "react";
import { uploadMineSkinFile } from "../mineskin";
import { StudioGeneration } from "../studio-generation";

/** The Studio's generation. Leaving the page stops waiting for an upload. */
export function useStudioGeneration() {
  const [generation] = useState(() => new StudioGeneration(uploadMineSkinFile));
  useSyncExternalStore(
    generation.subscribe,
    generation.getSnapshot,
    generation.getSnapshot,
  );
  useEffect(() => () => generation.cancel(), [generation]);
  return generation;
}
