import { Effect } from "effect";
import { Atom, AtomRegistry } from "effect/reactivity";

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

/**
 * Runs the job it is set to and interrupts the previous one. Each job
 * publishes its own result, so an interrupted job publishes none.
 */
export const latestEffectAtom = () =>
  Atom.fn((job: Effect.Effect<void>) => job);

/**
 * One job at a time for a store outside React. A new job or `cancel`
 * interrupts the running one. The atom lives in the owner's own registry, so
 * it is released with the owner.
 */
export class LatestEffect {
  private readonly registry = AtomRegistry.make();
  private readonly atom = Atom.keepAlive(latestEffectAtom());

  /** Start `job`. The Promise settles when the job ends or is interrupted. */
  run(job: Effect.Effect<void>) {
    return new Promise<void>((resolve) => {
      this.registry.set(
        this.atom,
        job.pipe(
          Effect.ensuring(
            Effect.sync(() => {
              resolve();
            }),
          ),
        ),
      );
    });
  }

  cancel() {
    this.registry.set(this.atom, Atom.Reset);
  }
}
