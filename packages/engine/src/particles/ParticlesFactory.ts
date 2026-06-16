import { SpdParticleBackend } from './internal/SpdParticleBackend';
import { ParticlePresetResolver } from './ParticlePresetResolver';
import { ParticlesManager } from './ParticlesManager';

import type { AssetManager } from '@engine/assets';

export class ParticlesFactory {
  static createDefault(assets: AssetManager): ParticlesManager {
    return new ParticlesManager(new ParticlePresetResolver(assets), new SpdParticleBackend(assets));
  }
}
