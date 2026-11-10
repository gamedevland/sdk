import { AbortableOperation } from '../../lifecycle/AbortableOperation';
import { RetryTimeoutError } from './RetryTimeoutError';
/** A bounded attempt with cooperative abort and cleanup of an uncooperative late result. */
export class TimeoutAbortExecutor {
  constructor(private readonly timeoutMs: number) {}

  async run<T>(
    attemptNumber: number,
    fn: (signal: AbortSignal) => Promise<T>,
    parentSignal?: AbortSignal,
    onLateValue?: (value: T) => void,
  ): Promise<T> {
    parentSignal?.throwIfAborted();
    const controller = new AbortController();
    const abort = (): void => controller.abort(parentSignal?.reason);
    parentSignal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(
      () =>
        controller.abort(
          new RetryTimeoutError(
            this.timeoutMs,
            attemptNumber,
            new DOMException('Attempt timed out', 'AbortError'),
          ),
        ),
      this.timeoutMs,
    );
    try {
      return await AbortableOperation.wait(
        Promise.resolve().then(() => {
          controller.signal.throwIfAborted();
          return fn(controller.signal);
        }),
        controller.signal,
        onLateValue,
      );
    } finally {
      clearTimeout(timer);
      parentSignal?.removeEventListener('abort', abort);
    }
  }
}
