export class RetryTimeoutError extends Error {
  readonly timeoutMs: number;
  readonly attemptNumber: number;
  override readonly cause: unknown;

  constructor(timeoutMs: number, attemptNumber: number, cause: unknown) {
    super(`Asset load attempt timed out after ${timeoutMs}ms (attempt ${attemptNumber})`);
    this.name = 'RetryTimeoutError';
    this.timeoutMs = timeoutMs;
    this.attemptNumber = attemptNumber;
    this.cause = cause;
  }
}
