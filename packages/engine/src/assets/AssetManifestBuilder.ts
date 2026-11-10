import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { AssetDescriptor, AssetType, BundleDescriptor } from './types';

export type AssetGlobRecord = Record<string, string>;

export interface AssetGlobInput {
  audio: AssetGlobRecord;
  configsJson: AssetGlobRecord;
  localesJson: AssetGlobRecord;
  layoutsJson: AssetGlobRecord;
  prefabsJson: AssetGlobRecord;
  images: AssetGlobRecord;
  fonts: AssetGlobRecord;
  models?: AssetGlobRecord;
}

export interface AssetIdStrategy {
  toAssetId(filePath: string): string;
}

export class PathRelativeAssetIdStrategy implements AssetIdStrategy {
  constructor(private readonly assetsSegment: string = '/assets/') {}

  toAssetId(filePath: string): string {
    const normalizedPath = this.normalizePath(filePath);
    const markerIndex = normalizedPath.indexOf(this.assetsSegment);
    if (markerIndex === -1) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.AssetInvalidConfig,
        subsystem: EngineSubsystem.Asset,
        message: 'Unable to derive asset id from path',
        details: {
          filePath,
          assetsSegment: this.assetsSegment,
          method: 'PathRelativeAssetIdStrategy.toAssetId',
        },
      });
    }
    const relative = normalizedPath.slice(markerIndex + this.assetsSegment.length);
    if (!relative) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.AssetInvalidConfig,
        subsystem: EngineSubsystem.Asset,
        message: 'Derived empty asset id from path',
        details: {
          filePath,
          method: 'PathRelativeAssetIdStrategy.toAssetId',
        },
      });
    }
    return relative;
  }

  private normalizePath(filePath: string): string {
    return filePath.replaceAll('\\', '/');
  }
}

interface BundleRule {
  name: string;
  type: AssetType;
  files: AssetGlobRecord;
}

export interface BundleBuildPolicy {
  createRules(input: AssetGlobInput): readonly BundleRule[];
}

export class DefaultBundleBuildPolicy implements BundleBuildPolicy {
  createRules(input: AssetGlobInput): readonly BundleRule[] {
    return [
      { name: 'audio', type: 'audio', files: input.audio },
      { name: 'configs', type: 'json', files: input.configsJson },
      { name: 'locales', type: 'json', files: input.localesJson },
      { name: 'layouts', type: 'json', files: input.layoutsJson },
      { name: 'prefabs', type: 'json', files: input.prefabsJson },
      { name: 'images', type: 'image', files: input.images },
      { name: 'fonts', type: 'font', files: input.fonts },
      { name: 'models', type: 'model', files: input.models ?? {} },
    ];
  }
}

export interface AssetManifestBuilderOptions {
  idStrategy?: AssetIdStrategy;
  policy?: BundleBuildPolicy;
}

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
