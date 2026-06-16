import { RetryTimeoutError } from './RetryTimeoutError';

/**
 * Executes one async attempt with timeout-driven abort semantics.
 */
export class TimeoutAbortExecutor {
  private static readonly ABORT_ERROR_NAME = 'AbortError';

  constructor(private readonly timeoutMs: number) {}

  async run<T>(attemptNumber: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    try {
      return await fn(controller.signal);
    } catch (error) {
      if (timedOut && TimeoutAbortExecutor.isAbortError(error)) {
        throw new RetryTimeoutError(this.timeoutMs, attemptNumber, error);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private static isAbortError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return error.name === TimeoutAbortExecutor.ABORT_ERROR_NAME;
  }
}
