/** A shared concurrency limit across all simultaneous bundle and ID requests. */
export class AssetLoadQueue {
  private running = 0;
  private readonly pending: Array<() => void> = [];
  constructor(private readonly limit: number) {}

  run<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push(() => {
        this.running++;
        void Promise.resolve()
          .then(operation)
          .then(resolve, reject)
          .finally(() => {
            this.running--;
            this.drain();
          });
      });
      this.drain();
    });
  }

  private drain(): void {
    while (this.running < this.limit && this.pending.length) this.pending.shift()?.();
  }
}
