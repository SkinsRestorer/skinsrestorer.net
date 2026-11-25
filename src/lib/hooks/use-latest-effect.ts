import { RegistryContext, useAtomMount } from "@effect/atom-react";
import type { Effect } from "effect";
import { Atom } from "effect/reactivity";
import { useContext, useMemo, useState } from "react";
import { latestEffectAtom } from "../latest-effect";

/** Unmounting the component releases the atom and interrupts its job. */
const latestEffect = () => Atom.setIdleTTL(latestEffectAtom(), 0);

/**
 * Run one job at a time. A new job, `cancel`, or unmounting interrupts the
 * running one.
 */
export function useLatestEffect() {
  // oxlint-disable-next-line react/hook-use-state -- Each component owns one atom and never replaces it.
  const [atom] = useState(latestEffect);
  const registry = useContext(RegistryContext);
  useAtomMount(atom);
  return useMemo(
    () => ({
      run: (job: Effect.Effect<void>) => {
        registry.set(atom, job);
      },
      cancel: () => {
        registry.set(atom, Atom.Reset);
      },
    }),
    [atom, registry],
  );
}
