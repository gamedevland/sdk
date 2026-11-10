import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '../../errors';
import { AbortableOperation } from '../../lifecycle/AbortableOperation';
import { AssetLoadQueue } from './AssetLoadQueue';
import { RetryHelper } from './Retry';
import type { AssetDescriptor, AssetId, ConcurrencyConfig, RetryConfig } from '../types';
import type { LoaderRegistry } from './Registry';
import type { AssetStore } from './Store';

interface AssetLoadCoordinatorDeps {
  loaders: LoaderRegistry;
  store: AssetStore;
  retry: RetryConfig;
  concurrency: ConcurrencyConfig;
  baseURL: string;
}
/** Owns single-flight requests, one global queue and cancellation of all engine asset work. */
export class AssetLoadCoordinator {
  private readonly controller = new AbortController();
  private readonly queue: AssetLoadQueue;
  private readonly inFlightLoads = new Map<AssetId, Promise<void>>();
  constructor(private readonly deps: AssetLoadCoordinatorDeps) {
    this.queue = new AssetLoadQueue(deps.concurrency.maxParallel);
  }

  async loadDescriptors(
    descriptors: AssetDescriptor[],
    required = false,
    signal?: AbortSignal,
  ): Promise<void> {
    this.controller.signal.throwIfAborted();
    signal?.throwIfAborted();
    const operation = Promise.allSettled(descriptors.map((descriptor) => this.loadSingle(descriptor))).then(
      (results) => {
        if (!required) return;
        const errors = results.flatMap((result) => (result.status === 'rejected' ? [result.reason] : []));
        if (errors.length) throw new AggregateError(errors, 'Required asset loading failed');
      },
    );
    // A caller can stop waiting without cancelling another caller's shared request.
    await AbortableOperation.wait(operation, signal);
  }

  isLoading(id: AssetId): boolean {
    return this.inFlightLoads.has(id);
  }

  async destroy(): Promise<void> {
    this.controller.abort(new DOMException('Asset manager disposed', 'AbortError'));
    await Promise.allSettled([...this.inFlightLoads.values()]);
  }

  private loadSingle(descriptor: AssetDescriptor): Promise<void> {
    if (this.deps.store.has(descriptor.id)) return Promise.resolve();
    const existing = this.inFlightLoads.get(descriptor.id);
    if (existing) return existing;
    const operation = this.queue.run(() => this.executeLoad(descriptor));
    this.inFlightLoads.set(descriptor.id, operation);
    void operation.then(
      () => this.inFlightLoads.delete(descriptor.id),
      () => this.inFlightLoads.delete(descriptor.id),
    );
    return operation;
  }

  private async executeLoad(descriptor: AssetDescriptor): Promise<void> {
    this.controller.signal.throwIfAborted();
    const loader = this.deps.loaders.get(descriptor.type);
    if (!loader) throw this.failure(descriptor, new Error('Loader is not registered: ' + descriptor.type));
    const retry = this.deps.retry;
    const helper = new RetryHelper(retry.retries, retry.backoffMs, retry.backoffFactor, retry.timeoutMs);
    try {
      const data = await helper.withRetry(
        (signal) => loader.load(descriptor, signal, this.deps.baseURL),
        this.controller.signal,
        (value) => loader.dispose?.(value),
      );
      if (this.controller.signal.aborted) {
        loader.dispose?.(data);
        this.controller.signal.throwIfAborted();
      }
      const meta = this.deps.store.ensureMeta(descriptor);
      meta.data = data;
      meta.lastUsedAt = Date.now();
      if (loader.dispose) meta.dispose = loader.dispose.bind(loader);
    } catch (cause) {
      throw this.failure(descriptor, cause);
    }
  }

  private failure(descriptor: AssetDescriptor, cause: unknown): Error {
    return EngineErrorFactory.create({
      code: EngineErrorCode.AssetLoadFailure,
      subsystem: EngineSubsystem.Asset,
      message: 'Asset loading failed',
      details: { id: descriptor.id, type: descriptor.type },
      cause,
    });
  }
}
