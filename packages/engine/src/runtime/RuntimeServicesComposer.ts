import { LayoutRuntimeSystem } from './LayoutRuntimeSystem';
import { ParticlesRuntimeSystem } from './ParticlesRuntimeSystem';
import { PhysicsRuntimeSystem } from './PhysicsRuntimeSystem';
import { RuntimePhysicsStepService } from './RuntimePhysicsStepService';
import { RuntimeScheduler } from './RuntimeScheduler';
import { SceneServicesRuntimeSystem } from './SceneServicesRuntimeSystem';
import { TweensRuntimeSystem } from './TweensRuntimeSystem';

import type { RuntimePhysicsStepPort } from './RuntimePhysicsStepService';
import type { PhysicsRuntime } from '@engine/core';
import type { Scene } from '@engine/scenes/SceneManager';
import type SceneManager from '@engine/scenes/SceneManager';

interface CreatePhysicsStepServiceParams {
  engine: PhysicsRuntime;
  sceneManager: SceneManager;
  scheduler: RuntimeScheduler<Scene>;
}

/**
 * Composes runtime scheduler services and static system registrations.
 */
export class RuntimeServicesComposer {
  createScheduler(): RuntimeScheduler<Scene> {
    const scheduler = new RuntimeScheduler<Scene>();
    this.registerStaticSystems(scheduler);
    return scheduler;
  }

  createPhysicsStepService(params: CreatePhysicsStepServiceParams): RuntimePhysicsStepPort {
    return new RuntimePhysicsStepService(params.engine, params.sceneManager, params.scheduler);
  }

  private registerStaticSystems(scheduler: RuntimeScheduler<Scene>): void {
    scheduler.register(new LayoutRuntimeSystem(), { staticSystem: true });
    scheduler.register(new SceneServicesRuntimeSystem(), { staticSystem: true });
    scheduler.register(new PhysicsRuntimeSystem(), { staticSystem: true });
    scheduler.register(new ParticlesRuntimeSystem(), { staticSystem: true });
    scheduler.register(new TweensRuntimeSystem(), { staticSystem: true });
  }
}
