import type { BundleDescriptor } from '../types';

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
