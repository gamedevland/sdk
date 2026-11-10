import type { RuntimeSceneLifecycleContext, RuntimeSystem } from './types';
import type { Scene } from '@engine/scenes/SceneManager';

export class RuntimeLifecycleDispatcher<TScene extends Scene = Scene> {
  private paused = false;

  isPaused(): boolean {
    return this.paused;
  }

  setPaused(paused: boolean, systems: readonly RuntimeSystem<TScene>[]): void {
    if (this.paused === paused) {
      return;
    }
    this.paused = paused;
    const errors: unknown[] = [];
    for (const system of systems) {
      try {
        if (paused) {
          system.onPause?.();
        } else {
          system.onResume?.();
        }
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'Runtime pause notification failed');
  }

  notifySceneEnter(
    ctx: RuntimeSceneLifecycleContext<TScene>,
    systems: readonly RuntimeSystem<TScene>[],
  ): void {
    const entered: RuntimeSystem<TScene>[] = [];
    try {
      for (const system of systems) {
        entered.push(system);
        system.onSceneEnter?.(ctx);
      }
    } catch (cause) {
      try {
        this.notifySceneExit(ctx, entered);
      } catch (cleanup) {
        throw new AggregateError([cause, cleanup], 'Runtime system entry and rollback failed');
      }
      throw cause;
    }
  }

  notifySceneExit(
    ctx: RuntimeSceneLifecycleContext<TScene>,
    systems: readonly RuntimeSystem<TScene>[],
  ): void {
    const errors: unknown[] = [];
    for (let i = systems.length - 1; i >= 0; i -= 1) {
      const system = systems[i];
      if (!system) continue;
      try {
        system.onSceneExit?.(ctx);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'Runtime scene exit failed');
  }
}
