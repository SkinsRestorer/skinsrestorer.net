/** Run `callback` after `ms` milliseconds. Returns a function that cancels it. */
export type Timer = (callback: () => void, ms: number) => () => void;

export const timeout: Timer = (callback, ms) => {
  const id = setTimeout(callback, ms);
  return () => {
    clearTimeout(id);
  };
};

/**
 * Write typed text to the URL after a pause. The input and the filter use the
 * text at once; only the history entry waits. A write that is still waiting
 * when the location changes (Back, Forward, or a link) is dropped, so it
 * cannot overwrite the newer entry.
 */
export class LocationWrite<T> {
  /** An identity of the current history entry. */
  private readonly location: () => string;
  private readonly write: (value: T) => void;
  private readonly wait: number;
  private readonly timer: Timer;
  private waiting:
    | { value: T; location: string; cancel: () => void }
    | undefined;

  constructor(
    location: () => string,
    write: (value: T) => void,
    wait: number,
    timer: Timer = timeout,
  ) {
    this.location = location;
    this.write = write;
    this.wait = wait;
    this.timer = timer;
  }

  schedule(value: T) {
    this.cancel();
    const location = this.location();
    const cancel = this.timer(() => {
      this.flush();
    }, this.wait);
    this.waiting = { value, location, cancel };
  }

  /** Write the waiting value now, if its entry is still current. */
  flush() {
    const waiting = this.waiting;
    if (!waiting) return;
    this.cancel();
    if (waiting.location === this.location()) this.write(waiting.value);
  }

  cancel() {
    this.waiting?.cancel();
    this.waiting = undefined;
  }
}
