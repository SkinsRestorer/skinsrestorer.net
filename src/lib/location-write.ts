import { Debouncer } from "@tanstack/pacer";

/**
 * Write typed text to the URL after a pause. The input and the filter use the
 * text at once; only the history entry waits. A write that is still waiting
 * when the location changes (Back, Forward, or a link) is dropped, so it
 * cannot overwrite the newer entry.
 */
export class LocationWrite<T> {
  private readonly debouncer: Debouncer<(value: T, location: string) => void>;

  constructor(
    /** An identity of the current history entry. */
    private readonly location: () => string,
    write: (value: T) => void,
    wait: number,
  ) {
    this.debouncer = new Debouncer(
      (value: T, scheduledAt: string) => {
        if (scheduledAt === this.location()) write(value);
      },
      { wait },
    );
  }

  schedule(value: T) {
    this.debouncer.maybeExecute(value, this.location());
  }

  /** Write the waiting value now, if its entry is still current. */
  flush() {
    this.debouncer.flush();
  }

  cancel() {
    this.debouncer.cancel();
  }
}
