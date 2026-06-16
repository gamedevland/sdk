import type { AssetType, BundleDescriptor, Loader } from '../types';

/**
 * Holds a mapping from asset type to its loader implementation.
 */
export class LoaderRegistry {
  private loaders: Map<AssetType, Loader> = new Map();

  /**
   * Register a loader for a specific asset type.
   */
  register(type: AssetType, loader: Loader): void {
    this.loaders.set(type, loader);
  }

  /**
   * Retrieve a loader for the given asset type.
   */
  get(type: AssetType): Loader | undefined {
    return this.loaders.get(type);
  }
}

/**
 * Stores and retrieves bundle descriptors by name.
 */
export class BundleRegistry {
  private bundles: Map<string, BundleDescriptor> = new Map();

  /**
   * Register one or more bundles.
   */
  register(...bundles: BundleDescriptor[]): void {
    for (const b of bundles) this.bundles.set(b.name, b);
  }

  /**
   * Get a bundle by its name.
   */
  get(name: string): BundleDescriptor | undefined {
    return this.bundles.get(name);
  }

  /**
   * Iterate over all registered bundles.
   */
  all(): IterableIterator<BundleDescriptor> {
    return this.bundles.values();
  }
}
