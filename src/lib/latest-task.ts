/** Framework callbacks can publish only while they still own the latest request. */
export class LatestTask {
  private active: AbortController | undefined;

  cancel() {
    const previous = this.active;
    this.active = undefined;
    previous?.abort();
  }

  async run<A>(
    work: (signal: AbortSignal) => Promise<A>,
    success: (value: A) => void,
    failure: (cause: unknown) => void,
  ) {
    this.cancel();
    const current = new AbortController();
    this.active = current;
    try {
      const value = await work(current.signal);
      if (this.active === current) success(value);
    } catch (cause) {
      if (this.active === current) failure(cause);
    } finally {
      if (this.active === current) this.active = undefined;
    }
  }
}
