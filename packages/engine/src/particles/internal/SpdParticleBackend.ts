import { Emitter } from '@spd789562/particle-emitter';
import { ParticleContainer } from 'pixi.js';

import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { SpdParticleBackendEmitter } from './SpdParticleBackendEmitter';
import { SpdPresetMapper } from './SpdPresetMapper';
import { SpdPresetTextureMapper } from './SpdPresetTextureMapper';
import { SpdTextureResolver } from './SpdTextureResolver';
import { StaticScaleXYBehavior } from './StaticScaleXYBehavior';

import type { ParticleBackend, ParticleBackendEmitter } from './ParticleBackend';
import type { ParticleEmitterOptions } from '../types';
import type { AssetManager } from '@engine/assets';

export class SpdParticleBackend implements ParticleBackend {
  private static customBehaviorsRegistered = false;
  private readonly textureResolver: SpdTextureResolver | undefined;
  private readonly presetTextureMapper: SpdPresetTextureMapper | undefined;

  constructor(assets?: AssetManager) {
    this.registerCustomBehaviors();
    if (assets) {
      const textureResolver = new SpdTextureResolver(assets);
      this.textureResolver = textureResolver;
      this.presetTextureMapper = new SpdPresetTextureMapper((assetId) =>
        textureResolver.resolveRequired(assetId),
      );
    }
  }

  private registerCustomBehaviors(): void {
    if (SpdParticleBackend.customBehaviorsRegistered) {
      return;
    }
    Emitter.registerBehavior(StaticScaleXYBehavior);
    SpdParticleBackend.customBehaviorsRegistered = true;
  }

  createEmitter(params: ParticleEmitterOptions): ParticleBackendEmitter {
    try {
      const parentView = params.parent.view;
      const particleLayer = new ParticleContainer({
        dynamicProperties: {
          color: true,
          position: true,
          rotation: true,
          scale: true,
          uvs: true,
          vertex: true,
        },
      });
      parentView.addChild(particleLayer);

      const baseConfig = SpdPresetMapper.toEmitterConfig(params);
      const config = this.presetTextureMapper
        ? this.presetTextureMapper.map(baseConfig)
        : baseConfig;
      const emitter = new Emitter(particleLayer, config);
      emitter.autoUpdate = false;

      if (params.autoStart === false) {
        emitter.emit = false;
      }

      return new SpdParticleBackendEmitter(emitter, particleLayer, parentView);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw EngineErrorFactory.create({
        code: EngineErrorCode.ParticleRuntimeFailure,
        subsystem: EngineSubsystem.Particle,
        message: 'Failed to create particle emitter',
        details: { method: 'SpdParticleBackend.createEmitter', reason: message },
        cause: error,
      });
    }
  }
}
