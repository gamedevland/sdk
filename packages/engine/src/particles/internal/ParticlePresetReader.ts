import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';
import { SchemaDecoder } from '@engine/validation';

import type { Decoder } from '@engine/validation';

interface RandNumberInput {
  readonly min: number;
  readonly max: number;
}

interface PosInput {
  readonly x: number;
  readonly y: number;
}

interface BehaviorInput {
  readonly type: string;
  readonly config: unknown;
}

interface EaseSegmentInput {
  readonly cp: number;
  readonly s: number;
  readonly e: number;
}

interface PresetInput {
  readonly lifetime: RandNumberInput;
  readonly frequency: number;
  readonly pos: PosInput;
  readonly behaviors: readonly BehaviorInput[];
  readonly ease: string | readonly EaseSegmentInput[] | undefined;
  readonly particlesPerWave: number | undefined;
  readonly spawnChance: number | undefined;
  readonly emitterLifetime: number | undefined;
  readonly maxParticles: number | undefined;
  readonly addAtBack: boolean | undefined;
  readonly emit: boolean | undefined;
  readonly autoUpdate: boolean | undefined;
}

export class ParticlePresetReader {
  private static readonly RAND_NUMBER: Decoder<RandNumberInput> = SchemaDecoder.object({
    min: SchemaDecoder.number(),
    max: SchemaDecoder.number(),
  });

  private static readonly POS: Decoder<PosInput> = SchemaDecoder.object({
    x: SchemaDecoder.number(),
    y: SchemaDecoder.number(),
  });

  private static readonly BEHAVIOR: Decoder<BehaviorInput> = SchemaDecoder.object({
    type: SchemaDecoder.string({ nonEmpty: true }),
    config: SchemaDecoder.unknown(),
  });

  private static readonly EASE_SEGMENT: Decoder<EaseSegmentInput> = SchemaDecoder.object({
    cp: SchemaDecoder.number(),
    s: SchemaDecoder.number(),
    e: SchemaDecoder.number(),
  });

  private static readonly EASE: Decoder<string | readonly EaseSegmentInput[] | undefined> = (
    input: unknown,
    context,
  ) => {
    if (input === undefined) {
      return undefined;
    }
    if (typeof input === 'string') {
      return input;
    }
    if (Array.isArray(input)) {
      return SchemaDecoder.array(ParticlePresetReader.EASE_SEGMENT)(input, context);
    }
    throw EngineErrorFactory.invalidInput({
      code: EngineErrorCode.ParticleInvalidConfig,
      subsystem: EngineSubsystem.Particle,
      message: `${context.source} expected string or array at '${context.path}'`,
      details: { actualType: ParticlePresetReader.describeType(input), source: context.source, path: context.path },
    });
  };

  private static readonly PRESET: Decoder<PresetInput> = SchemaDecoder.object({
    lifetime: ParticlePresetReader.RAND_NUMBER,
    frequency: SchemaDecoder.number({ min: 0 }),
    pos: ParticlePresetReader.POS,
    behaviors: SchemaDecoder.array(ParticlePresetReader.BEHAVIOR),
    ease: ParticlePresetReader.EASE,
    particlesPerWave: SchemaDecoder.optional(SchemaDecoder.number({ integer: true, min: 1 })),
    spawnChance: SchemaDecoder.optional(SchemaDecoder.number({ min: 0, max: 1 })),
    emitterLifetime: SchemaDecoder.optional(SchemaDecoder.number({ min: 0 })),
    maxParticles: SchemaDecoder.optional(SchemaDecoder.number({ integer: true, min: 1 })),
    addAtBack: SchemaDecoder.optional(SchemaDecoder.boolean()),
    emit: SchemaDecoder.optional(SchemaDecoder.boolean()),
    autoUpdate: SchemaDecoder.optional(SchemaDecoder.boolean()),
  });

  static read(input: Record<string, unknown>, source: string) {
    const preset = SchemaDecoder.decode(input, ParticlePresetReader.PRESET, source);

    const config = {
      lifetime: preset.lifetime,
      frequency: preset.frequency,
      pos: preset.pos,
      behaviors: [...preset.behaviors],
      ...(preset.ease === undefined
        ? {}
        : { ease: typeof preset.ease === 'string' ? preset.ease : [...preset.ease] }),
      ...(preset.particlesPerWave === undefined ? {} : { particlesPerWave: preset.particlesPerWave }),
      ...(preset.spawnChance === undefined ? {} : { spawnChance: preset.spawnChance }),
      ...(preset.emitterLifetime === undefined ? {} : { emitterLifetime: preset.emitterLifetime }),
      ...(preset.maxParticles === undefined ? {} : { maxParticles: preset.maxParticles }),
      ...(preset.addAtBack === undefined ? {} : { addAtBack: preset.addAtBack }),
      ...(preset.emit === undefined ? {} : { emit: preset.emit }),
      ...(preset.autoUpdate === undefined ? {} : { autoUpdate: preset.autoUpdate }),
    };

    return config;
  }

  private static describeType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }
}
