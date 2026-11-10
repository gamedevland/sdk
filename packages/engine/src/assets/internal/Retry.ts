import { AbortableOperation } from '../../lifecycle/AbortableOperation';
import { TimeoutAbortExecutor } from './TimeoutAbortExecutor';
/** Bounded attempts with abortable backoff and independent per-attempt timeouts. */
export class RetryHelper {
  private readonly timeoutExecutor: TimeoutAbortExecutor;
  constructor(
    private readonly retries: number,
    private readonly backoffMs: number,
    private readonly backoffFactor: number,
    timeoutMs: number,
  ) {
    this.timeoutExecutor = new TimeoutAbortExecutor(timeoutMs);
  }

  async withRetry<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
    onLateValue?: (value: T) => void,
  ): Promise<T> {
    let delay = this.backoffMs;
    for (let attempt = 0; ; attempt++) {
      signal?.throwIfAborted();
      try {
        return await this.timeoutExecutor.run(attempt + 1, fn, signal, onLateValue);
      } catch (error) {
        signal?.throwIfAborted();
        if (attempt >= this.retries) throw error;
        await this.backoff(delay, signal);
        delay *= this.backoffFactor;
      }
    }
  }

  private async backoff(delay: number, signal?: AbortSignal): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await AbortableOperation.wait(
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, delay);
        }),
        signal,
      );
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}
