import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';
import { SchemaDecoder } from '@engine/validation';

import { ParticlePresetReader } from './internal/ParticlePresetReader';

import type { ParticlePreset } from './types';
import type { AssetId, AssetManager } from '@engine/assets';

export type ParticlePresetId = string;
export type ParticlePresetManifest = Readonly<Record<ParticlePresetId, AssetId>>;

export class ParticlePresetResolver {
  private readonly cacheByAssetId = new Map<AssetId, ParticlePreset>();

  constructor(
    private readonly assets: AssetManager,
    private readonly manifest: ParticlePresetManifest = {},
  ) {}

  async resolveById(id: ParticlePresetId): Promise<ParticlePreset> {
    const assetId = this.getRequiredAssetId(id);
    return this.resolveByAssetId(assetId, `ParticlePresetResolver.resolveById(${id})`);
  }

  async resolveByAssetId(
    assetId: AssetId,
    source: string = 'ParticlePresetResolver.resolveByAssetId',
  ): Promise<ParticlePreset> {
    const cached = this.cacheByAssetId.get(assetId);
    if (cached !== undefined) {
      return cached;
    }

    const raw = this.assets.getRequired<unknown>(assetId, source);
    const payload = SchemaDecoder.decode(raw, SchemaDecoder.record(), source);
    const preset = ParticlePresetReader.read(payload, source);

    this.cacheByAssetId.set(assetId, preset);
    return preset;
  }

  private getRequiredAssetId(id: ParticlePresetId): AssetId {
    const assetId = this.manifest[id];
    if (assetId !== undefined) {
      return assetId;
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.ParticleMissingRequired,
      subsystem: EngineSubsystem.Particle,
      message: 'Unknown particle preset id',
      details: { id, method: 'ParticlePresetResolver.getRequiredAssetId' },
    });
  }
}
