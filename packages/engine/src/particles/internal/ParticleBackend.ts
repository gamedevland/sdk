import type { ParticleEmitterOptions, ParticleVec2 } from '../types';

export interface ParticleBackendEmitter {
  start(): void;
  playOnce(onComplete: () => void): void;
  stop(): void;
  emitNow(): void;
  setPosition(position: ParticleVec2): void;
  update(dt: number): void;
  destroy(): void;
}

export interface ParticleBackend {
  createEmitter(params: ParticleEmitterOptions): ParticleBackendEmitter;
}
