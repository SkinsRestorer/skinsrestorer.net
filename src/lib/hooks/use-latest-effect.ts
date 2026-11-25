import { RegistryContext, useAtomMount } from "@effect/atom-react";
import { Effect } from "effect";
import { Atom } from "effect/reactivity";
import { useContext, useMemo, useState } from "react";

/**
 * A Promise read as an Effect. Interrupting the Effect aborts the signal, and
 * the rejection reason stays the typed error.
 */
export function abortable<A>(work: (signal: AbortSignal) => PromiseLike<A>) {
  // The Promise APIs reject with their own typed errors, which callers
  // translate as they are.
  // oxlint-disable-next-line effecttsgo/unknown-in-effect-catch
  return Effect.tryPromise({ try: work, catch: (cause) => cause });
}

/** Each job publishes its own result, so an interrupted job publishes none. */
const latestEffect = () =>
  Atom.setIdleTTL(
    Atom.fn((job: Effect.Effect<void>) => job),
    0,
  );

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
