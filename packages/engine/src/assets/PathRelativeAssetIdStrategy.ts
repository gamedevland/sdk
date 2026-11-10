import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';
import type { AssetIdStrategy } from './AssetManifestTypes';

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

