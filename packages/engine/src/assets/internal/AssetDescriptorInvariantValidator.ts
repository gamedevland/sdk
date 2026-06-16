import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { AssetDescriptor, AssetId, BundleDescriptor } from '../types';

export class AssetDescriptorInvariantValidator {
  validateBundleRegistration(incoming: BundleDescriptor[], registeredBundles: Iterable<BundleDescriptor>): void {
    const knownBundleNames = new Set<string>();
    for (const bundle of registeredBundles) {
      knownBundleNames.add(bundle.name);
    }

    const incomingBundleNames = new Set<string>();
    for (const bundle of incoming) {
      if (knownBundleNames.has(bundle.name)) {
        throw EngineErrorFactory.conflict({
          code: EngineErrorCode.AssetConflict,
          subsystem: EngineSubsystem.Asset,
          message: 'Bundle is already registered',
          details: { bundle: bundle.name, method: 'AssetDescriptorInvariantValidator.validateBundleRegistration' },
        });
      }
      if (incomingBundleNames.has(bundle.name)) {
        throw EngineErrorFactory.conflict({
          code: EngineErrorCode.AssetConflict,
          subsystem: EngineSubsystem.Asset,
          message: 'Duplicate bundle in a single registration call',
          details: { bundle: bundle.name, method: 'AssetDescriptorInvariantValidator.validateBundleRegistration' },
        });
      }
      incomingBundleNames.add(bundle.name);
    }
  }

  assertNoDuplicateAssetIdInBundle(bundleName: string, assetId: AssetId): void {
    throw EngineErrorFactory.conflict({
      code: EngineErrorCode.AssetConflict,
      subsystem: EngineSubsystem.Asset,
      message: 'Duplicate asset id inside bundle',
      details: { bundle: bundleName, id: assetId },
    });
  }

  assertAssetIdNotRegisteredInAnotherBundle(
    assetId: AssetId,
    existingOwner: string,
    incomingOwner: string,
  ): void {
    throw EngineErrorFactory.conflict({
      code: EngineErrorCode.AssetConflict,
      subsystem: EngineSubsystem.Asset,
      message: 'Asset id is already registered in another bundle',
      details: { id: assetId, existingOwner, incomingOwner },
    });
  }

  assertNoDescriptorConflictInDedupe(assetId: AssetId): void {
    throw EngineErrorFactory.conflict({
      code: EngineErrorCode.AssetConflict,
      subsystem: EngineSubsystem.Asset,
      message: 'Conflicting descriptors for asset',
      details: { id: assetId, method: 'AssetDescriptorInvariantValidator.assertNoDescriptorConflictInDedupe' },
    });
  }

  assertBundleExists(bundleName: string): never {
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.AssetMissingRequired,
      subsystem: EngineSubsystem.Asset,
      message: 'Bundle not found',
      details: { bundle: bundleName, method: 'AssetDescriptorInvariantValidator.assertBundleExists' },
    });
  }

  getRequiredBundle(bundle: BundleDescriptor | undefined, bundleName: string): BundleDescriptor {
    if (bundle) {
      return bundle;
    }
    this.assertBundleExists(bundleName);
  }

  assertBundleContainsAllRequestedIds(bundleName: string, missingIds: AssetId[]): never {
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.AssetMissingRequired,
      subsystem: EngineSubsystem.Asset,
      message: 'Unknown asset ids in bundle',
      details: { bundle: bundleName, missing: missingIds.join(', ') },
    });
  }

  assertNoDescriptorConflictAcrossBundles(assetId: AssetId, leftOwner: string, rightOwner: string): never {
    throw EngineErrorFactory.conflict({
      code: EngineErrorCode.AssetConflict,
      subsystem: EngineSubsystem.Asset,
      message: 'Conflicting descriptors between bundles',
      details: { id: assetId, leftOwner, rightOwner },
    });
  }

  assertAllRequestedIdsResolvable(missingIds: AssetId[]): never {
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.AssetMissingRequired,
      subsystem: EngineSubsystem.Asset,
      message: 'Unknown asset ids',
      details: { missing: missingIds.join(', ') },
    });
  }

  getRequiredResolvedDescriptor(descriptor: AssetDescriptor | undefined, assetId: AssetId): AssetDescriptor {
    if (descriptor) {
      return descriptor;
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.AssetMissingRequired,
      subsystem: EngineSubsystem.Asset,
      message: 'Resolved asset descriptor is missing',
      details: { id: assetId, method: 'AssetDescriptorInvariantValidator.getRequiredResolvedDescriptor' },
    });
  }
}
