import type { AssetType } from './types';

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

export interface BundleRule {
  name: string;
  type: AssetType;
  files: AssetGlobRecord;
}

export interface BundleBuildPolicy {
  createRules(input: AssetGlobInput): readonly BundleRule[];
}

export interface AssetManifestBuilderOptions {
  idStrategy?: AssetIdStrategy;
  policy?: BundleBuildPolicy;
}
