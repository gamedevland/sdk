import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { AssetLoadPolicy } from './internal/AssetLoadPolicy';
import { AssetDescriptorResolver } from './internal/DescriptorResolver';
import { AssetLoadCoordinator } from './internal/LoadCoordinator';
import { BundleRegistry, LoaderRegistry } from './internal/Registry';
import { AssetStore } from './internal/Store';

import type {
  AssetDescriptor,
  AssetId,
  AssetType,
  BundleDescriptor,
  ConcurrencyConfig,
  Loader,
  RetryConfig,
} from './types';

/**
 * Configuration options for the AssetManager.
 *
 * - baseURL: Prefix used to resolve relative `descriptor.url` values.
 * - retry: Controls retry/backoff/timeout behavior for each asset load.
 * - concurrency: Limits the number of parallel loads to avoid network saturation.
 */
export interface AssetManagerOptions {
  baseURL?: string;
  retry?: Partial<RetryConfig>;
  concurrency?: Partial<ConcurrencyConfig>;
}

/**
 * AssetManager orchestrates asset loading, caching, and lifetime management.
 *
 * Responsibilities:
 * - Registers loaders for specific asset types (images, json, etc.).
 * - Loads single assets or bundles with bounded concurrency and retry logic.
 * - Stores loaded resources.
 */
export class AssetManager {
  private readonly baseURL: string;
  private readonly retry: RetryConfig;
  private readonly concurrency: ConcurrencyConfig;

  private loaders = new LoaderRegistry();
  private bundles = new BundleRegistry();
  private store = new AssetStore();
  private readonly descriptorResolver: AssetDescriptorResolver;
  private readonly loadCoordinator: AssetLoadCoordinator;

  /**
   * Creates a new AssetManager.
   *
   * @param options Optional manager configuration.
   */
  constructor(options?: AssetManagerOptions) {
    this.baseURL = options?.baseURL ?? '/';
    this.retry = {
      retries: options?.retry?.retries ?? 2,
      backoffMs: options?.retry?.backoffMs ?? 300,
      backoffFactor: options?.retry?.backoffFactor ?? 2,
      timeoutMs: options?.retry?.timeoutMs ?? 15000,
    };
    this.concurrency = {
      maxParallel: options?.concurrency?.maxParallel ?? 6,
    };
    AssetLoadPolicy.validate(this.retry, this.concurrency);
    this.descriptorResolver = new AssetDescriptorResolver(this.bundles);
    this.loadCoordinator = new AssetLoadCoordinator({
      loaders: this.loaders,
      store: this.store,
      retry: this.retry,
      concurrency: this.concurrency,
      baseURL: this.baseURL,
    });
  }

  /**
   * Registers a loader implementation for a given asset type.
   *
   * @param type Asset type key (e.g. 'image', 'json').
   * @param loader Loader instance capable of fetching and decoding the asset.
   */
  registerLoader(type: AssetType, loader: Loader): void {
    this.loaders.register(type, loader);
  }

  /**
   * Registers one or more bundles.
   * A bundle is a named collection of asset descriptors.
   *
   * @param bundles One or more bundle descriptors.
   */
  registerBundles(...bundles: BundleDescriptor[]): void {
    this.descriptorResolver.validateBundleRegistration(bundles);
    this.bundles.register(...bundles);
  }

  /**
   * Return ids of all assets registered in bundles.
   * Useful for catalog-like discovery where ids follow naming conventions.
   */
  getRegisteredAssetIds(): AssetId[] {
    return this.descriptorResolver.getRegisteredAssetIds();
  }

  getBundleAssetIds(name: string, type?: AssetType): AssetId[] {
    const bundle = this.getRequiredBundle(name);
    const ids: AssetId[] = [];
    for (const asset of bundle.assets) {
      if (type !== undefined && asset.type !== type) {
        continue;
      }
      ids.push(asset.id);
    }
    return ids;
  }

  /**
   * Retrieves a previously loaded asset by id.
   * Access updates last-used timestamp to aid eviction heuristics.
   *
   * @param id Asset identifier.
   * @returns The typed resource or undefined if not loaded yet.
   */
  get<T = unknown>(id: AssetId): T | undefined {
    return this.store.get<T>(id);
  }

  /**
   * Retrieves a previously loaded asset by id or throws if not loaded.
   *
   * @param id Asset identifier.
   * @param source Optional source name for diagnostic context.
   * @returns The typed resource.
   * @throws {Error} If the asset is not loaded.
   */
  getRequired<T = unknown>(id: AssetId, source?: string): T {
    const data = this.get<T>(id);
    if (data !== undefined) {
      return data;
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.AssetMissingRequired,
      subsystem: EngineSubsystem.Asset,
      message: 'Asset is not loaded',
      details: { id, ...(source === undefined ? {} : { source }) },
    });
  }

  /**
   * Convenience helper to load (if needed) and return a JSON asset by id.
   *
   * @remarks
   * This is primarily used by config loaders. It is intentionally strict:
   * if the asset cannot be resolved after loading, it throws with context.
   *
   * @param {AssetId} id Asset identifier (must exist in some registered bundle).
   * @returns {Promise<T>} Parsed JSON data.
   * @throws {Error} If the asset is not registered or could not be loaded.
   */
  async getJson<T = unknown>(id: AssetId): Promise<T> {
    if (!this.has(id)) {
      await this.loadRequired(id);
    }
    const data = this.get<T>(id);
    if (data === undefined) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.AssetMissingRequired,
        subsystem: EngineSubsystem.Asset,
        message: 'JSON asset is not loaded',
        details: { id, method: 'AssetManager.getJson' },
      });
    }
    return data;
  }

  /**
   * Checks whether an asset has been loaded and stored.
   *
   * @param id Asset identifier.
   */
  has(id: AssetId): boolean {
    return this.store.has(id);
  }

  /**
   * Loads one or more assets by id, optionally scoping selection by bundle.
   *
   * Note: If a bundle is provided, only the specified ids that exist in that bundle are loaded.
   *
   * @param ids Single id or list of ids to load.
   * @param opts Optional bundle filter.
   */
  async load(ids: AssetId | AssetId[], opts?: { bundle?: string; signal?: AbortSignal }): Promise<void> {
    const descriptors = this.descriptorResolver.resolveDescriptorsForLoad(ids, opts?.bundle);
    if (descriptors.length === 0) return;
    await this.loadCoordinator.loadDescriptors(descriptors, false, opts?.signal);
  }

  /** Loads required IDs with original per-asset causes; abort only cancels this caller's wait. */
  async loadRequired(
    ids: AssetId | AssetId[],
    opts?: { bundle?: string; signal?: AbortSignal },
  ): Promise<void> {
    const descriptors = this.descriptorResolver.resolveDescriptorsForLoad(ids, opts?.bundle);
    await this.loadCoordinator.loadDescriptors(descriptors, true, opts?.signal);
  }

  /**
   * Loads all assets in the specified bundle.
   *
   * @param name Bundle name.
   */
  async loadBundle(name: string): Promise<void> {
    const bundle = this.getRequiredBundle(name);
    const descriptors = this.descriptorResolver.dedupeDescriptorsOrThrow(bundle.assets);
    await this.loadDescriptors(descriptors);
  }

  /** Loads a bundle and rejects if any required resource failed, including after loader retries. */
  async loadRequiredBundle(name: string, options?: { signal?: AbortSignal }): Promise<void> {
    const descriptors = this.descriptorResolver.dedupeDescriptorsOrThrow(this.getRequiredBundle(name).assets);
    await this.loadCoordinator.loadDescriptors(descriptors, true, options?.signal);
  }

  /** Release an unused resource. Loader-owned live leases may reject disposal. */
  unload(id: AssetId): void {
    if (this.loadCoordinator.isLoading(id)) throw new Error('Cannot unload an asset while loading: ' + id);
    this.store.unload(id);
  }

  /**
   * Core loading routine that resolves descriptors and loads them with bounded concurrency.
   * Uses an internal queue and a dynamic pool of running promises.
   *
   * Complex parts explained:
   * - A sliding window of up to `maxParallel` promises is maintained. As soon as one completes,
   *   the next descriptor is started (see `Promise.race` + `finally` cleanup).
   * - Each asset is loaded with retry and timeout controls via `RetryHelper`.
   * - If a loader is missing for an asset type, the entry is marked as failed and processing continues.
   *
   * @param descriptors Asset descriptors to load.
   */
  private async loadDescriptors(descriptors: AssetDescriptor[]): Promise<void> {
    await this.loadCoordinator.loadDescriptors(descriptors);
  }
  private getRequiredBundle(name: string): BundleDescriptor {
    const bundle = this.bundles.get(name);
    if (!bundle) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.AssetMissingRequired,
        subsystem: EngineSubsystem.Asset,
        message: 'Bundle not found',
        details: { bundle: name, method: 'AssetManager.getRequiredBundle' },
      });
    }
    return bundle;
  }
  async destroy(): Promise<void> {
    await this.loadCoordinator.destroy();
    this.store.destroy();
  }
}
