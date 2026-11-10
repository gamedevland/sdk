import type { AssetId } from '@engine/assets';
import type { Container } from '@engine/renderers/pixi';
import type { ParticlePresetReader } from './internal/ParticlePresetReader';

export type ParticleHandle = string;

export interface ParticleVec2 {
  readonly x: number;
  readonly y: number;
}

export type ParticlePreset = ReturnType<typeof ParticlePresetReader.read>;

export interface ParticleEmitterOptions {
  readonly preset: ParticlePreset;
  readonly parent: Container;
  readonly position?: ParticleVec2;
  readonly autoStart?: boolean;
}

export interface ParticleSpawnParams {
  readonly preset: ParticlePreset;
  readonly parent: Container;
  readonly position: ParticleVec2;
}

export interface ParticleSpawnFromAssetParams {
  readonly presetAssetId: AssetId;
  readonly parent: Container;
  readonly position: ParticleVec2;
  readonly source?: string;
}
