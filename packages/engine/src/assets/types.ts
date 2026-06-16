/**
 * Uniquely identifies an asset within the asset system.
 */
export type AssetId = string;

/**
 * Enumerates supported asset kinds. A loader must be registered per type.
 */
export type AssetType = 'image' | 'audio' | 'json' | 'font';

/**
 * Describes a single asset input for the loader pipeline.
 *
 * - id: Unique id for lookup and dependency mapping.
 * - type: Asset type that selects a registered loader.
 * - url: Relative or absolute URL. Will be resolved against `baseURL` if relative.
 * - importedUrl: Pre-resolved URL via bundler import or `new URL(...)`.
 *   Takes precedence over `url` when provided.
 */
export interface AssetDescriptor {
  id: AssetId;
  type: AssetType;
  url?: string; // Absolute/relative path (e.g. under public/assets)
  importedUrl?: string; // URL resolved via import or new URL(...)
}

/**
 * Named collection of asset descriptors that can be loaded as a group.
 */
export interface BundleDescriptor {
  name: string;
  assets: AssetDescriptor[];
}

/**
 * Controls retry strategy for asset loading operations.
 */
export interface RetryConfig {
  retries: number;
  backoffMs: number;
  backoffFactor: number;
  timeoutMs: number;
}

/**
 * Defines concurrency limits for loader execution.
 */
export interface ConcurrencyConfig {
  maxParallel: number;
}

/**
 * A loader fetches and decodes resources for a specific asset type.
 *
 * Implementations should:
 * - Use the provided AbortSignal to cancel network work when needed.
 * - Honor `baseURL` when resolving relative URLs.
 * - Optionally implement `dispose` to release resources (e.g. ImageBitmap.close()).
 */
export interface Loader {
  load(descriptor: AssetDescriptor, signal: AbortSignal, baseURL?: string): Promise<unknown>;
  dispose?(resource: unknown): void;
}
