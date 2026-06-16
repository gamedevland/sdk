import { SchemaDecoder } from '@engine/validation';

import { ParticlePresetReader } from '../../particles/internal/ParticlePresetReader';

import { BaseTypedComponent } from './BaseTypedComponent';

import type { ParticleHandle, ParticlePreset, ParticleVec2 } from '../../particles';
import type { Container } from '../nodes/Container';
import type { Decoder } from '@engine/validation';

interface ParticleEmitterComponentConfig {
  readonly preset: Record<string, unknown>;
  readonly autoStart: boolean;
  readonly position: ParticleVec2 | undefined;
}

export class ParticleEmitterComponent extends BaseTypedComponent<ParticleEmitterComponentConfig, Container> {
  private static readonly CONFIG: Decoder<ParticleEmitterComponentConfig> = SchemaDecoder.object({
    preset: SchemaDecoder.record(),
    autoStart: SchemaDecoder.boolean({ defaultValue: true }),
    position: SchemaDecoder.optional(
      SchemaDecoder.object({
        x: SchemaDecoder.number(),
        y: SchemaDecoder.number(),
      }),
    ),
  });

  protected override readonly configDecoder = ParticleEmitterComponent.CONFIG;

  private emitterHandle: ParticleHandle | undefined;

  protected override onEnable(): void {
    if (this.emitterHandle === undefined) {
      const preset = this.toPreset(this.config.preset, 'ParticleEmitterComponent.config.preset');
      this.emitterHandle = this.node.engine.particles.createEmitter({
        preset,
        parent: this.node,
        ...(this.config.position === undefined ? {} : { position: this.config.position }),
        autoStart: false,
      });
    }

    if (this.config.autoStart) {
      this.node.engine.particles.start(this.emitterHandle);
    }
  }

  protected override onDisable(): void {
    const handle = this.emitterHandle;
    if (handle === undefined) {
      return;
    }
    this.node.engine.particles.stop(handle);
  }

  override onDetach(): void {
    const handle = this.emitterHandle;
    this.emitterHandle = undefined;

    if (handle !== undefined) {
      this.node.engine.particles.destroy(handle);
    }

    super.onDetach();
  }

  private toPreset(value: Record<string, unknown>, source: string): ParticlePreset {
    return ParticlePresetReader.read(value, source);
  }
}
