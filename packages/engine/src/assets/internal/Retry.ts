import { TimeoutAbortExecutor } from './TimeoutAbortExecutor';

/**
 * Implements a simple retry with exponential backoff and a per-attempt timeout.
 */
export class RetryHelper {
  private readonly timeoutExecutor: TimeoutAbortExecutor;

  constructor(
    private retries: number,
    private backoffMs: number,
    private backoffFactor: number,
    private timeoutMs: number,
  ) {
    this.timeoutExecutor = new TimeoutAbortExecutor(this.timeoutMs);
  }

  /**
   * Executes the provided async function with retries.
   * Each failed attempt waits for an increasing delay before retrying.
   */
  async withRetry<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    let attempt = 0;
    let delay = this.backoffMs;
    while (true) {
      try {
        const res = await this.runAttempt(fn, attempt + 1);
        return res;
      } catch (err) {
        attempt += 1;
        if (attempt > this.retries) throw err;
        await new Promise((r) => setTimeout(r, delay));
        delay *= this.backoffFactor;
      }
    }
  }

  /**
   * Runs one attempt with timeout-driven cancellation.
   */
  private async runAttempt<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    attemptNumber: number,
  ): Promise<T> {
    return await this.timeoutExecutor.run(attemptNumber, fn);
  }
}
