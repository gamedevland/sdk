/** A lifecycle budget counts visible time; browser suspension is not scene work. */
export class SceneHookDeadline {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private remainingMs: number;
  private startedAt = 0;

  constructor(
    timeoutMs: number,
    private readonly page: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'> | undefined =
      typeof document === 'undefined' ? undefined : document,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.remainingMs = timeoutMs;
  }

  async run(hook: () => Promise<void> | void, createTimeoutError: () => Error): Promise<void> {
    let rejectTimeout: (reason: Error) => void = () => {};
    const timeout = new Promise<never>((_resolve, reject) => { rejectTimeout = reject; });
    const update = (): void => {
      if (this.timer !== undefined) {
        clearTimeout(this.timer);
        this.timer = undefined;
        this.remainingMs -= this.now() - this.startedAt;
      }
      if (this.page?.hidden) return;
      this.startedAt = this.now();
      this.timer = setTimeout(() => {
        // Visibility may change before its event is delivered on browser resume.
        if (this.page?.hidden) { update(); return; }
        rejectTimeout(createTimeoutError());
      }, Math.max(0, this.remainingMs));
    };
    this.page?.addEventListener('visibilitychange', update);
    update();
    try {
      await Promise.race([Promise.resolve().then(hook), timeout]);
    } finally {
      if (this.timer !== undefined) clearTimeout(this.timer);
      this.page?.removeEventListener('visibilitychange', update);
    }
  }
}
