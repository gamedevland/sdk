import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { SpdParticleBackend } from './internal/SpdParticleBackend';

import type { ParticleBackend, ParticleBackendEmitter } from './internal/ParticleBackend';
import type { ParticlePresetResolver } from './ParticlePresetResolver';
import type {
  ParticleEmitterOptions,
  ParticleHandle,
  ParticleSpawnFromAssetParams,
  ParticleSpawnParams,
  ParticleVec2,
} from './types';
import type { Container as PixiContainer } from 'pixi.js';

/**
 * Public particles orchestration facade with deterministic emitter lifecycle ownership.
 */
export class ParticlesManager {
  private static readonly ONESHOT_TTL_GRACE_SECONDS = 0.1;

  private readonly emitters = new Map<ParticleHandle, ParticleEmitterRecord>();
  private readonly oneShotTtls = new Map<ParticleHandle, number>();
  private readonly playOnceResolvers = new Map<ParticleHandle, () => void>();
  private readonly presetResolver: ParticlePresetResolver;
  private handleCounter = 0;

  constructor(
    presetResolver: ParticlePresetResolver,
    private readonly backend: ParticleBackend = new SpdParticleBackend(),
  ) {
    this.presetResolver = presetResolver;
  }

  createEmitter(params: ParticleEmitterOptions): ParticleHandle {
    const emitter = this.backend.createEmitter(params);
    const handle = this.createHandle();
    this.emitters.set(handle, {
      backendEmitter: emitter,
      parentView: params.parent.view,
    });
    return handle;
  }

  start(handle: ParticleHandle): void {
    this.getRequiredEmitter(handle, 'ParticlesManager.start').start();
  }

  playOnce(handle: ParticleHandle): Promise<void> {
    return new Promise((resolve) => {
      this.playOnceResolvers.set(handle, resolve);
      this.getRequiredEmitter(handle, 'ParticlesManager.playOnce').playOnce(() => {
        const activeResolve = this.playOnceResolvers.get(handle);
        if (activeResolve === undefined) {
          return;
        }
        this.playOnceResolvers.delete(handle);
        activeResolve();
      });
    });
  }

  stop(handle: ParticleHandle): void {
    this.getRequiredEmitter(handle, 'ParticlesManager.stop').stop();
  }

  emitBurst(params: ParticleSpawnParams): void {
    const handle = this.createEmitter({
      ...params,
      autoStart: false,
    });
    const emitter = this.getRequiredEmitter(handle, 'ParticlesManager.emitBurst');
    emitter.emitNow();
    emitter.stop();
    this.oneShotTtls.set(handle, this.resolveOneShotTtlSeconds(params));
  }

  async emitBurstFromAsset(params: ParticleSpawnFromAssetParams): Promise<void> {
    const preset = await this.presetResolver.resolveByAssetId(
      params.presetAssetId,
      params.source ?? 'ParticlesManager.emitBurstFromAsset',
    );
    this.emitBurst({
      preset,
      parent: params.parent,
      position: params.position,
    });
  }

  setEmitterPosition(handle: ParticleHandle, position: ParticleVec2): void {
    this.getRequiredEmitter(handle, 'ParticlesManager.setEmitterPosition').setPosition(position);
  }

  destroy(handle: ParticleHandle): void {
    const emitter = this.getRequiredEmitter(handle, 'ParticlesManager.destroy');
    const resolve = this.playOnceResolvers.get(handle);
    if (resolve !== undefined) {
      this.playOnceResolvers.delete(handle);
      resolve();
    }
    this.oneShotTtls.delete(handle);
    this.emitters.delete(handle);
    emitter.destroy();
  }

  destroyAll(): void {
    const errors: string[] = [];
    for (const resolve of this.playOnceResolvers.values()) {
      resolve();
    }
    for (const [handle, record] of this.emitters) {
      try {
        record.backendEmitter.destroy();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`handle '${handle}': ${message}`);
      }
    }
    this.emitters.clear();
    this.oneShotTtls.clear();
    this.playOnceResolvers.clear();

    if (errors.length > 0) {
      throw EngineErrorFactory.create({
        code: EngineErrorCode.ParticleRuntimeFailure,
        subsystem: EngineSubsystem.Particle,
        message: 'Failed to destroy all emitters',
        details: { method: 'ParticlesManager.destroyAll', errors: errors.join('; ') },
      });
    }
  }

  destroyInSubtree(rootView: PixiContainer): void {
    const handlesToDestroy: ParticleHandle[] = [];
    for (const [handle, record] of this.emitters) {
      if (this.isSameOrDescendant(record.parentView, rootView)) {
        handlesToDestroy.push(handle);
      }
    }

    const errors: string[] = [];
    for (const handle of handlesToDestroy) {
      try {
        this.destroy(handle);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`handle '${handle}': ${message}`);
      }
    }

    if (errors.length > 0) {
      throw EngineErrorFactory.create({
        code: EngineErrorCode.ParticleRuntimeFailure,
        subsystem: EngineSubsystem.Particle,
        message: 'Failed to destroy emitters in subtree',
        details: { method: 'ParticlesManager.destroyInSubtree', errors: errors.join('; ') },
      });
    }
  }

  getActiveEmitterCount(): number {
    return this.emitters.size;
  }

  tick(dt: number): void {
    if (this.emitters.size === 0) {
      return;
    }

    let failedHandles: ParticleHandle[] | undefined;
    let updateErrors: string[] | undefined;

    for (const [handle, record] of this.emitters) {
      try {
        record.backendEmitter.update(dt);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!failedHandles) {
          failedHandles = [];
        }
        if (!updateErrors) {
          updateErrors = [];
        }
        failedHandles.push(handle);
        updateErrors.push(`handle '${handle}': ${message}`);
      }
    }

    if (failedHandles) {
      for (const handle of failedHandles) {
        try {
          this.destroy(handle);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!updateErrors) {
            updateErrors = [];
          }
          updateErrors.push(`handle '${handle}' destroy after update failure: ${message}`);
        }
      }
    }

    this.updateOneShotTimers(dt);

    if (updateErrors && updateErrors.length > 0) {
      throw EngineErrorFactory.create({
        code: EngineErrorCode.ParticleRuntimeFailure,
        subsystem: EngineSubsystem.Particle,
        message: 'Emitter update failed',
        details: { method: 'ParticlesManager.tick', errors: updateErrors.join('; ') },
      });
    }
  }

  private createHandle(): ParticleHandle {
    this.handleCounter += 1;
    return `particle#${String(this.handleCounter)}`;
  }

  private getRequiredEmitter(handle: ParticleHandle, source: string): ParticleBackendEmitter {
    if (handle.length === 0) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.ParticleInvalidArgument,
        subsystem: EngineSubsystem.Particle,
        message: 'Emitter handle must be a non-empty string',
        details: { source, method: 'ParticlesManager.getRequiredEmitter' },
      });
    }
    const record = this.emitters.get(handle);
    if (record !== undefined) {
      return record.backendEmitter;
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.ParticleMissingRequired,
      subsystem: EngineSubsystem.Particle,
      message: 'Emitter handle is not active',
      details: { source, handle, method: 'ParticlesManager.getRequiredEmitter' },
    });
  }

  private resolveOneShotTtlSeconds(params: ParticleSpawnParams): number {
    const lifetimeMax = params.preset.lifetime.max;
    if (Number.isFinite(lifetimeMax) && lifetimeMax >= 0) {
      return lifetimeMax + ParticlesManager.ONESHOT_TTL_GRACE_SECONDS;
    }
    return 1 + ParticlesManager.ONESHOT_TTL_GRACE_SECONDS;
  }

  private updateOneShotTimers(dt: number): void {
    const expiredHandles: ParticleHandle[] = [];

    for (const [handle, ttl] of this.oneShotTtls) {
      const nextTtl = ttl - dt;
      if (nextTtl <= 0) {
        expiredHandles.push(handle);
      } else {
        this.oneShotTtls.set(handle, nextTtl);
      }
    }

    for (const handle of expiredHandles) {
      this.destroy(handle);
    }
  }

  private isSameOrDescendant(node: PixiContainer, ancestor: PixiContainer): boolean {
    let current: PixiContainer | null = node;
    while (current) {
      if (current === ancestor) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }
}

interface ParticleEmitterRecord {
  readonly backendEmitter: ParticleBackendEmitter;
  readonly parentView: PixiContainer;
}
