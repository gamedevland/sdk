import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { ParticleBackendEmitter } from './ParticleBackend';
import type { ParticleVec2 } from '../types';
import type { Emitter } from '@spd789562/particle-emitter';
import type { Container as PixiContainer, ParticleContainer } from 'pixi.js';

export class SpdParticleBackendEmitter implements ParticleBackendEmitter {
  private destroyed = false;

  constructor(
    private readonly emitter: Emitter,
    private readonly layer: ParticleContainer,
    private readonly parentView: PixiContainer,
  ) {}

  start(): void {
    this.assertNotDestroyed('start');
    this.emitter.emit = true;
  }

  playOnce(onComplete: () => void): void {
    this.assertNotDestroyed('playOnce');
    this.emitter.playOnce(onComplete);
  }

  stop(): void {
    this.assertNotDestroyed('stop');
    this.emitter.emit = false;
  }

  emitNow(): void {
    this.assertNotDestroyed('emitNow');
    this.emitter.emitNow();
  }

  setPosition(position: ParticleVec2): void {
    this.assertNotDestroyed('setPosition');
    this.emitter.updateSpawnPos(position.x, position.y);
  }

  update(dt: number): void {
    this.assertNotDestroyed('update');
    this.emitter.update(dt);
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;

    try {
      this.emitter.emit = false;
      this.emitter.cleanup();
      this.emitter.destroy();
    } finally {
      if (this.layer.parent === this.parentView) {
        this.parentView.removeChild(this.layer);
      }
      if (!this.layer.destroyed) {
        this.layer.destroy({ children: true });
      }
    }
  }

  private assertNotDestroyed(method: string): void {
    if (this.destroyed) {
      throw EngineErrorFactory.invariant({
        code: EngineErrorCode.ParticleInvariantViolation,
        subsystem: EngineSubsystem.Particle,
        message: 'Emitter is destroyed',
        details: { method: `SpdParticleBackendEmitter.${method}` },
      });
    }
  }
}
