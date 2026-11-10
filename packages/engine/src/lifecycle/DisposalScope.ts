/** Owns synchronous subscriptions/resources and exposes cooperative cancellation. */
export class DisposalScope {
  private readonly controller = new AbortController();
  private readonly disposers = new Set<() => void>();
  get signal(): AbortSignal {
    return this.controller.signal;
  }
  get disposed(): boolean {
    return this.signal.aborted;
  }

  own(dispose: () => void): () => void {
    if (this.disposed) {
      dispose();
      return () => {};
    }
    const release = (): void => {
      if (!this.disposers.delete(release)) return;
      dispose();
    };
    this.disposers.add(release);
    return release;
  }

  dispose(): void {
    if (this.disposed) return;
    this.controller.abort();
    const errors: unknown[] = [];
    for (const dispose of [...this.disposers].reverse()) {
      try {
        dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'Resource scope disposal failed');
  }
}
