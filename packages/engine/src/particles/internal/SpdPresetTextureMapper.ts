import { RuntimeTypeGuards } from '../../common/RuntimeTypeGuards';

import type { EmitterConfigV3 } from '@spd789562/particle-emitter';
import type { Texture } from 'pixi.js';

export class SpdPresetTextureMapper {
  constructor(private readonly resolveTexture: (assetId: string) => Texture) {}

  map(config: EmitterConfigV3): EmitterConfigV3 {
    return {
      ...config,
      behaviors: this.mapBehaviors(config.behaviors),
    };
  }

  private mapBehaviors(behaviors: EmitterConfigV3['behaviors']): EmitterConfigV3['behaviors'] {
    const mapped: EmitterConfigV3['behaviors'] = [];

    for (const behavior of behaviors) {
      if (!RuntimeTypeGuards.isRecord(behavior.config)) {
        mapped.push(behavior);
        continue;
      }

      const config = behavior.config;
      const nextConfig: Record<string, unknown> = { ...config };
      let changed = false;

      const texture = config.texture;
      if (typeof texture === 'string') {
        nextConfig.texture = this.resolveTexture(texture);
        changed = true;
      }

      const textures = config.textures;
      if (Array.isArray(textures)) {
        const nextTextures: unknown[] = [];
        let texturesChanged = false;
        for (const entry of textures) {
          if (typeof entry === 'string') {
            nextTextures.push(this.resolveTexture(entry));
            texturesChanged = true;
            continue;
          }
          nextTextures.push(entry);
        }
        if (texturesChanged) {
          nextConfig.textures = nextTextures;
          changed = true;
        }
      }

      if (!changed) {
        mapped.push(behavior);
        continue;
      }

      mapped.push({
        type: behavior.type,
        config: nextConfig,
      });
    }

    return mapped;
  }
}
