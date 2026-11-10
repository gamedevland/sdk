import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { RuntimeDiagnostics } from '../diagnostics';
import { RuntimeExecutionEngine } from './RuntimeExecutionEngine';
import { RuntimeLifecycleDispatcher } from './RuntimeLifecycleDispatcher';
import { RuntimeSchedulerLeakGuard } from './RuntimeSchedulerLeakGuard';
import { RuntimeSchedulerProfilingMonitor } from './RuntimeSchedulerProfilingMonitor';
import { RuntimeSystemRegistry } from './RuntimeSystemRegistry';

import type { RuntimeSystemRegistrationOptions } from './RuntimeSystemRegistry';
import type { RuntimeSceneLifecycleContext, RuntimeSystem, RuntimeUpdateContext } from './types';
import type { Scene } from '@engine/scenes/SceneManager';

interface RuntimeTickOptions {
  ignorePause?: boolean;
}

/**
 * Engine-owned orchestrator for deterministic runtime system updates.
 */
export class RuntimeScheduler<TScene extends Scene = Scene> {
  private readonly registry = new RuntimeSystemRegistry<TScene>();
  private readonly leakGuard = new RuntimeSchedulerLeakGuard();
  private readonly lifecycle = new RuntimeLifecycleDispatcher<TScene>();
  private readonly execution: RuntimeExecutionEngine<TScene>;

  constructor(diagnostics?: RuntimeDiagnostics) {
    this.execution = new RuntimeExecutionEngine(new RuntimeSchedulerProfilingMonitor(), diagnostics);
  }

  register(system: RuntimeSystem<TScene>, options?: RuntimeSystemRegistrationOptions): void {
    this.registry.register(system, options);
  }

  deregister(key: string): void {
    this.registry.deregister(key);
  }

  tick(dt: number, ctx: Omit<RuntimeUpdateContext<TScene>, 'frame'>): void {
    if (this.lifecycle.isPaused()) {
      return;
    }
    this.execution.tickAll(dt, ctx, this.registry.getOrderedSystems());
  }

  tickSystem(
    key: string,
    dt: number,
    ctx: Omit<RuntimeUpdateContext<TScene>, 'frame'>,
    options?: RuntimeTickOptions,
  ): void {
    if (this.lifecycle.isPaused() && !options?.ignorePause) {
      return;
    }
    const system = this.registry.getSystem(key);
    if (!system) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.CoreMissingRequired,
        subsystem: EngineSubsystem.Core,
        message: `Runtime system with key '${key}' is not registered`,
        details: { method: 'RuntimeScheduler.tickSystem', key },
      });
    }
    this.execution.tickSystem(dt, ctx, system);
  }

  captureSceneRegistrationBaseline(scene: Scene): void {
    this.leakGuard.captureBaseline(scene, this.registry.snapshotDynamicSystemKeys());
  }

  assertSceneRegistrationClean(scene: Scene): void {
    this.leakGuard.assertClean(scene, this.registry.snapshotDynamicSystemKeys());
  }

  setPaused(paused: boolean): void {
    this.lifecycle.setPaused(paused, this.registry.getOrderedSystems());
  }

  notifySceneEnter(ctx: RuntimeSceneLifecycleContext<TScene>): void {
    this.lifecycle.notifySceneEnter(ctx, this.registry.getOrderedSystems());
  }

  notifySceneExit(ctx: RuntimeSceneLifecycleContext<TScene>): void {
    this.lifecycle.notifySceneExit(ctx, this.registry.getOrderedSystems());
  }

  getRegisteredKeys(): readonly string[] {
    return this.registry.getRegisteredKeys();
  }
}
