import { PrepareUpload } from 'pixi.js';
import type { PrepareSourceItem } from 'pixi.js';

/** Uses Pixi's resource adapters without its RAF-only, resolve-only upload scheduler. */
export class PixiScenePreparer extends PrepareUpload {
  async prepare(resource: PrepareSourceItem, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    this.add(resource);
    this.dedupeQueue();
    try {
      while (this.queue.length > 0) {
        await this.nextBatch(signal);
        signal.throwIfAborted();
        for (let count = 0; count < 4 && this.queue.length > 0; count++) {
          signal.throwIfAborted();
          const item = this.queue.shift();
          if (item) this.uploadQueueItem(item);
        }
      }
    } finally {
      this.queue.length = 0;
      this.destroy();
    }
  }

  private nextBatch(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const onAbort = (): void => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, 0);
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}
