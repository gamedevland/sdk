import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { RuntimeSchedulerProfilingMonitor } from './RuntimeSchedulerProfilingMonitor';
import type { RuntimeSystem, RuntimeUpdateContext } from './types';
import type { Scene } from '@engine/scenes/SceneManager';

type RuntimeTickMethod = 'tick' | 'tickSystem';

export class RuntimeExecutionEngine<TScene extends Scene = Scene> {
  private frame = 0;

  constructor(private readonly profilingMonitor: RuntimeSchedulerProfilingMonitor) {}

  tickAll(
    dt: number,
    ctx: Omit<RuntimeUpdateContext<TScene>, 'frame'>,
    systems: readonly RuntimeSystem<TScene>[],
  ): void {
    this.validateDt(dt, 'tick');
    const updateCtx = this.nextUpdateContext(ctx);
    this.runSystems(dt, updateCtx, systems);
  }

  tickSystem(dt: number, ctx: Omit<RuntimeUpdateContext<TScene>, 'frame'>, system: RuntimeSystem<TScene>): void {
    this.validateDt(dt, 'tickSystem');
    const updateCtx = this.nextUpdateContext(ctx);
    this.runSystems(dt, updateCtx, [system]);
  }

  private nextUpdateContext(ctx: Omit<RuntimeUpdateContext<TScene>, 'frame'>): RuntimeUpdateContext<TScene> {
    this.frame += 1;
    return {
      ...ctx,
      frame: this.frame,
    };
  }

  private runSystems(
    dt: number,
    ctx: RuntimeUpdateContext<TScene>,
    systems: readonly RuntimeSystem<TScene>[],
  ): void {
    if (!this.profilingMonitor.isEnabled()) {
      for (const system of systems) {
        system.update(dt, ctx);
      }
      return;
    }

    const frameStart = performance.now();
    for (const system of systems) {
      system.update(dt, ctx);
    }
    this.profilingMonitor.onFrameEnd(performance.now() - frameStart);
  }

  private validateDt(dt: number, method: RuntimeTickMethod): void {
    if (!Number.isFinite(dt) || dt < 0) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.CoreInvalidArgument,
        subsystem: EngineSubsystem.Core,
        message: 'Runtime scheduler dt must be a non-negative finite number',
        details: { method: `RuntimeScheduler.${method}`, dt: String(dt) },
      });
    }
  }
}
