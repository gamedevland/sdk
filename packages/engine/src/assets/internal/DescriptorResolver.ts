import { AssetDescriptorInvariantValidator } from './AssetDescriptorInvariantValidator';

import type { AssetDescriptor, AssetId, BundleDescriptor } from '../types';
import type { BundleRegistry } from './Registry';

export class AssetDescriptorResolver {
  private readonly invariantValidator = new AssetDescriptorInvariantValidator();

  constructor(private readonly bundles: BundleRegistry) {}

  getRegisteredAssetIds(): AssetId[] {
    const ids = new Set<AssetId>();
    for (const bundle of this.bundles.all()) {
      for (const asset of bundle.assets) {
        ids.add(asset.id);
      }
    }
    return Array.from(ids.values());
  }

  validateBundleRegistration(incoming: BundleDescriptor[]): void {
    this.invariantValidator.validateBundleRegistration(incoming, this.bundles.all());

    const ownerByAssetId: Map<AssetId, string> = new Map();
    for (const bundle of this.bundles.all()) {
      for (const descriptor of bundle.assets) {
        ownerByAssetId.set(descriptor.id, bundle.name);
      }
    }

    for (const bundle of incoming) {
      const localSeen = new Set<AssetId>();
      for (const descriptor of bundle.assets) {
        if (localSeen.has(descriptor.id)) {
          this.invariantValidator.assertNoDuplicateAssetIdInBundle(bundle.name, descriptor.id);
        }
        localSeen.add(descriptor.id);

        const existingOwner = ownerByAssetId.get(descriptor.id);
        if (existingOwner && existingOwner !== bundle.name) {
          this.invariantValidator.assertAssetIdNotRegisteredInAnotherBundle(
            descriptor.id,
            existingOwner,
            bundle.name,
          );
        }
        ownerByAssetId.set(descriptor.id, bundle.name);
      }
    }
  }

  resolveDescriptorsForLoad(ids: AssetId | AssetId[], bundleName?: string): AssetDescriptor[] {
    const requestedIds = this.normalizeRequestedIds(ids);
    if (requestedIds.length === 0) return [];
    const resolved = bundleName
      ? this.resolveDescriptorsFromBundleOrThrow(requestedIds, bundleName)
      : this.resolveDescriptorsAcrossBundlesOrThrow(requestedIds);
    return this.dedupeDescriptorsOrThrow(resolved);
  }

  dedupeDescriptorsOrThrow(descriptors: AssetDescriptor[]): AssetDescriptor[] {
    const byId: Map<AssetId, AssetDescriptor> = new Map();
    const unique: AssetDescriptor[] = [];
    for (const descriptor of descriptors) {
      const existing = byId.get(descriptor.id);
      if (!existing) {
        byId.set(descriptor.id, descriptor);
        unique.push(descriptor);
        continue;
      }
      if (!this.areEquivalentDescriptors(existing, descriptor)) {
        this.invariantValidator.assertNoDescriptorConflictInDedupe(descriptor.id);
      }
    }
    return unique;
  }

  private normalizeRequestedIds(ids: AssetId | AssetId[]): AssetId[] {
    return Array.from(new Set(Array.isArray(ids) ? ids : [ids]));
  }

  private resolveDescriptorsFromBundleOrThrow(ids: AssetId[], bundleName: string): AssetDescriptor[] {
    const bundle = this.invariantValidator.getRequiredBundle(this.bundles.get(bundleName), bundleName);
    const byId = this.buildDescriptorMap(bundle.assets);
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      this.invariantValidator.assertBundleContainsAllRequestedIds(bundleName, missing);
    }
    return this.resolveRequiredByIds(byId, ids);
  }

  private resolveDescriptorsAcrossBundlesOrThrow(ids: AssetId[]): AssetDescriptor[] {
    const byId: Map<AssetId, AssetDescriptor> = new Map();
    const ownerById: Map<AssetId, string> = new Map();
    const requested = new Set(ids);
    for (const bundle of this.bundles.all()) {
      for (const descriptor of bundle.assets) {
        if (!requested.has(descriptor.id)) continue;
        const existing = byId.get(descriptor.id);
        if (!existing) {
          byId.set(descriptor.id, descriptor);
          ownerById.set(descriptor.id, bundle.name);
          continue;
        }
        if (!this.areEquivalentDescriptors(existing, descriptor)) {
          const leftOwner = ownerById.get(descriptor.id) ?? 'unknown';
          this.invariantValidator.assertNoDescriptorConflictAcrossBundles(
            descriptor.id,
            leftOwner,
            bundle.name,
          );
        }
      }
    }

    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      this.invariantValidator.assertAllRequestedIdsResolvable(missing);
    }

    return this.resolveRequiredByIds(byId, ids);
  }

  private areEquivalentDescriptors(left: AssetDescriptor, right: AssetDescriptor): boolean {
    if (left.type !== right.type) return false;
    if (left.url !== right.url) return false;
    if (left.importedUrl !== right.importedUrl) return false;
    return true;
  }

  private buildDescriptorMap(descriptors: AssetDescriptor[]): Map<AssetId, AssetDescriptor> {
    const byId: Map<AssetId, AssetDescriptor> = new Map();
    for (const descriptor of descriptors) {
      byId.set(descriptor.id, descriptor);
    }
    return byId;
  }

  private resolveRequiredByIds(
    byId: Map<AssetId, AssetDescriptor>,
    ids: AssetId[],
  ): AssetDescriptor[] {
    return ids.map((id) =>
      this.invariantValidator.getRequiredResolvedDescriptor(byId.get(id), id),
    );
  }
}
