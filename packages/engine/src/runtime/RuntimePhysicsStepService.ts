import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { RuntimeSystemKey } from './RuntimeSystemKey';

import type { RuntimeScheduler } from './RuntimeScheduler';
import type { PhysicsRuntime } from '@engine/core';
import type { Scene } from '@engine/scenes/SceneManager';
import type SceneManager from '@engine/scenes/SceneManager';

/**
 * Owns deterministic physics warmup ticks for the currently active scene.
 */
export interface RuntimePhysicsStepPort {
  warmupActiveScenePhysics(steps: number, dtSeconds: number): void;
}

export class RuntimePhysicsStepService implements RuntimePhysicsStepPort {
  constructor(
    private readonly engine: PhysicsRuntime,
    private readonly sceneManager: SceneManager,
    private readonly runtimeScheduler: RuntimeScheduler<Scene>,
  ) {}

  warmupActiveScenePhysics(steps: number, dtSeconds: number): void {
    this.validateSteps(steps);
    this.validateDtSeconds(dtSeconds);

    const activeScene = this.sceneManager.getCurrentScene();
    if (!activeScene) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.CoreMissingRequired,
        subsystem: EngineSubsystem.Core,
        message: 'Cannot warm up physics without an active scene',
        details: { method: 'RuntimePhysicsStepService.warmupActiveScenePhysics' },
      });
    }

    for (let step = 0; step < steps; step += 1) {
      this.runtimeScheduler.tickSystem(
        RuntimeSystemKey.Physics,
        dtSeconds,
        {
          engine: this.engine,
          activeScene,
        },
        { ignorePause: true },
      );
    }
  }

  private validateSteps(steps: number): void {
    if (!Number.isInteger(steps) || steps <= 0) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.CoreInvalidArgument,
        subsystem: EngineSubsystem.Core,
        message: 'Physics warmup steps must be a positive integer',
        details: {
          method: 'RuntimePhysicsStepService.warmupActiveScenePhysics',
          steps: String(steps),
        },
      });
    }
  }

  private validateDtSeconds(dtSeconds: number): void {
    if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.CoreInvalidArgument,
        subsystem: EngineSubsystem.Core,
        message: 'Physics warmup dtSeconds must be a positive finite number',
        details: {
          method: 'RuntimePhysicsStepService.warmupActiveScenePhysics',
          dtSeconds: String(dtSeconds),
        },
      });
    }
  }
}
