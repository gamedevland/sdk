/**
 * CompositeDisposer aggregates multiple unsubscribe functions and disposes them together.
 * Intended for short-lived interaction sessions (e.g., drag), to avoid leaking listeners.
 */
export class CompositeDisposer {
  private readonly offs = new Set<() => void>();

  /** Adds one or more unsubscribe functions; ignores undefined. */
  add(...fns: Array<(() => void) | undefined>): void {
    for (const fn of fns) if (typeof fn === 'function') this.offs.add(fn);
  }

  /** Disposes all registered unsubscribers and clears the collection. */
  disposeAll(): void {
    for (const off of this.offs) {
      try {
        off();
      } catch {
        /* noop */
      }
    }
    this.offs.clear();
  }
}

export default CompositeDisposer;
