/** Cancels observation without leaving rejected or late asynchronous results unobserved. */
export class AbortableOperation {
  static wait<T>(
    operation: PromiseLike<T>,
    signal?: AbortSignal,
    onLateValue?: (value: T) => void,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let cancelled = false;
      const abort = (): void => {
        cancelled = true;
        signal?.removeEventListener('abort', abort);
        reject(signal?.reason ?? new DOMException('Operation aborted', 'AbortError'));
      };
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
      void Promise.resolve(operation).then(
        (value) => {
          signal?.removeEventListener('abort', abort);
          if (cancelled) {
            try {
              onLateValue?.(value);
            } catch (error) {
              console.error('Late resource disposal failed', error);
            }
          } else resolve(value);
        },
        (error) => {
          signal?.removeEventListener('abort', abort);
          if (!cancelled) reject(error);
        },
      );
    });
  }
}
