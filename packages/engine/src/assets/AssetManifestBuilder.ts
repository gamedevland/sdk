import { PathRelativeAssetIdStrategy } from './PathRelativeAssetIdStrategy';
import { DefaultBundleBuildPolicy } from './DefaultBundleBuildPolicy';
import type { AssetDescriptor, AssetType, BundleDescriptor } from './types';
import type { AssetGlobRecord, AssetGlobInput, AssetIdStrategy, BundleBuildPolicy, AssetManifestBuilderOptions } from './AssetManifestTypes';

export { PathRelativeAssetIdStrategy } from './PathRelativeAssetIdStrategy';
export { DefaultBundleBuildPolicy } from './DefaultBundleBuildPolicy';
export type { AssetGlobRecord, AssetGlobInput, AssetIdStrategy, BundleBuildPolicy, AssetManifestBuilderOptions } from './AssetManifestTypes';

export class AssetManifestBuilder {
  private readonly idStrategy: AssetIdStrategy;
  private readonly policy: BundleBuildPolicy;

  constructor(
    private readonly input: AssetGlobInput,
    options?: AssetManifestBuilderOptions,
  ) {
    this.idStrategy = options?.idStrategy ?? new PathRelativeAssetIdStrategy();
    this.policy = options?.policy ?? new DefaultBundleBuildPolicy();
  }

  build(): BundleDescriptor[] {
    const rules = this.policy.createRules(this.input);
    return rules.map((rule) => ({
      name: rule.name,
      assets: this.toDescriptors(rule.files, rule.type),
    }));
  }

  private toDescriptors(files: AssetGlobRecord, type: AssetType): AssetDescriptor[] {
    return Object.entries(files)
      .filter(([filePath]) => !this.isIgnored(filePath))
      .map(([filePath, importedUrl]) => ({
        id: this.idStrategy.toAssetId(filePath),
        type,
        importedUrl,
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  private isIgnored(filePath: string): boolean {
    return filePath.endsWith('.DS_Store');
  }
}
