import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';
import { SchemaDecoder } from '@engine/validation';

import { ParticlePresetReader } from '../../particles/internal/ParticlePresetReader';
import { Container } from '../nodes/Container';

import { BaseTypedAction } from './BaseTypedAction';

import type { ParticlePreset, ParticleVec2 } from '../../particles';
import type { Decoder } from '@engine/validation';

interface PlayParticlesActionConfig {
  readonly preset: Record<string, unknown> | undefined;
  readonly presetAssetId: string | undefined;
  readonly position: ParticleVec2 | undefined;
  readonly space: 'local' | 'world';
}

interface PlayParticlesActionInput {
  readonly position: ParticleVec2 | undefined;
  readonly space: 'local' | 'world' | undefined;
}

export class PlayParticlesAction extends BaseTypedAction<
  PlayParticlesActionConfig,
  PlayParticlesActionInput
> {
  private static readonly SPACES = ['local', 'world'] as const;

  private static readonly CONFIG: Decoder<PlayParticlesActionConfig> = SchemaDecoder.object({
    preset: SchemaDecoder.optional(SchemaDecoder.record()),
    presetAssetId: SchemaDecoder.optional(SchemaDecoder.string({ nonEmpty: true })),
    position: SchemaDecoder.optional(
      SchemaDecoder.object({
        x: SchemaDecoder.number(),
        y: SchemaDecoder.number(),
      }),
    ),
    space: SchemaDecoder.enumOf<'local' | 'world'>(PlayParticlesAction.SPACES, {
      defaultValue: 'local',
    }),
  });

  private static readonly INPUT: Decoder<PlayParticlesActionInput> = SchemaDecoder.object({
    position: SchemaDecoder.optional(
      SchemaDecoder.object({
        x: SchemaDecoder.number(),
        y: SchemaDecoder.number(),
      }),
    ),
    space: SchemaDecoder.optional(
      SchemaDecoder.enumOf<'local' | 'world'>(PlayParticlesAction.SPACES),
    ),
  });

  protected override readonly configDecoder = PlayParticlesAction.CONFIG;
  protected override readonly inputDecoder = PlayParticlesAction.INPUT;

  protected override async execute(input: PlayParticlesActionInput): Promise<void> {
    if (!(this.node instanceof Container)) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Owner node must be a Container',
        details: { method: 'PlayParticlesAction.run', ownerType: this.node.constructor.name },
      });
    }

    const config = this.config;

    const rawPosition = input.position ?? config.position ?? { x: 0, y: 0 };
    const space = input.space ?? config.space;
    const position = space === 'world' ? this.node.toLocalPosition(rawPosition) : rawPosition;

    const presetAssetId = config.presetAssetId;
    if (presetAssetId !== undefined) {
      await this.node.emitBurstFromAsset({
        presetAssetId,
        position,
      });
      return;
    }

    const preset = config.preset;
    if (preset === undefined) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'One of "presetAssetId" or "preset" must be provided',
        details: { method: 'PlayParticlesAction.execute' },
      });
    }

    this.node.engine.particles.emitBurst({
      preset: this.toPreset(preset, 'PlayParticlesAction.config.preset'),
      parent: this.node,
      position,
    });
  }

  private toPreset(value: Record<string, unknown>, source: string): ParticlePreset {
    return ParticlePresetReader.read(value, source);
  }
}
