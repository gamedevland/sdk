import { RetryHelper } from './Retry';

import type { AssetDescriptor, AssetId, ConcurrencyConfig, Loader, RetryConfig } from '../types';
import type { LoaderRegistry } from './Registry';
import type { AssetMeta, AssetStore } from './Store';

interface AssetLoadCoordinatorDeps {
  loaders: LoaderRegistry;
  store: AssetStore;
  retry: RetryConfig;
  concurrency: ConcurrencyConfig;
  baseURL: string;
}

export class AssetLoadCoordinator {
  private disposed = false;
  private readonly loaders: LoaderRegistry;
  private readonly store: AssetStore;
  private readonly retry: RetryConfig;
  private readonly concurrency: ConcurrencyConfig;
  private readonly baseURL: string;
  private readonly inFlightLoads: Map<AssetId, Promise<void>> = new Map();

  constructor(deps: AssetLoadCoordinatorDeps) {
    this.loaders = deps.loaders;
    this.store = deps.store;
    this.retry = deps.retry;
    this.concurrency = deps.concurrency;
    this.baseURL = deps.baseURL;
  }

  async loadDescriptors(descriptors: AssetDescriptor[]): Promise<void> {
    if (this.disposed) throw new Error('Asset loader is disposed');
    const queue = [...descriptors];

    const runWithConcurrency = async () => {
      const running: Promise<void>[] = [];

      const next = async (descriptor: AssetDescriptor) => {
        if (this.disposed) return;
        const meta = this.store.ensureMeta(descriptor);
        if (meta.data !== undefined) {
          return;
        }

        const loader = this.loaders.get(descriptor.type);
        if (!loader) {
          return;
        }

        try {
          await this.loadWithSingleFlight(descriptor, loader, meta);
        } catch {
          void 0;
        }
      };

      while (queue.length > 0 || running.length > 0) {
        while (running.length < this.concurrency.maxParallel && queue.length > 0) {
          const descriptor = queue.shift();
          if (!descriptor) break;
          const task = next(descriptor).finally(() => {
            const index = running.indexOf(task);
            if (index >= 0) running.splice(index, 1);
          });
          running.push(task);
        }
        if (running.length > 0) {
          await Promise.race(running);
        }
      }
    };

    await runWithConcurrency();
  }

  async destroy(): Promise<void> {
    this.disposed = true;
    await Promise.allSettled(this.inFlightLoads.values());
  }

  private async loadWithSingleFlight(
    descriptor: AssetDescriptor,
    loader: Loader,
    meta: AssetMeta,
  ): Promise<void> {
    const existing = this.inFlightLoads.get(descriptor.id);
    if (existing) {
      await existing;
      return;
    }

    const startedLoad = this.executeLoad(descriptor, loader, meta);
    this.inFlightLoads.set(descriptor.id, startedLoad);
    try {
      await startedLoad;
    } finally {
      if (this.inFlightLoads.get(descriptor.id) === startedLoad) {
        this.inFlightLoads.delete(descriptor.id);
      }
    }
  }

  private async executeLoad(descriptor: AssetDescriptor, loader: Loader, meta: AssetMeta): Promise<void> {
    const helper = new RetryHelper(
      this.retry.retries,
      this.retry.backoffMs,
      this.retry.backoffFactor,
      this.retry.timeoutMs,
    );
    const data = await helper.withRetry((attemptSignal) =>
      loader.load(descriptor, attemptSignal, this.baseURL),
    );
    if (this.disposed) { loader.dispose?.(data); return; }
    meta.data = data;
    meta.lastUsedAt = Date.now();
    if (loader.dispose) meta.dispose = loader.dispose.bind(loader);
  }
}
