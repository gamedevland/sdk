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
    for (const system of systems) {
      if (paused) {
        system.onPause?.();
      } else {
        system.onResume?.();
      }
    }
  }

  notifySceneEnter(
    ctx: RuntimeSceneLifecycleContext<TScene>,
    systems: readonly RuntimeSystem<TScene>[],
  ): void {
    for (const system of systems) {
      system.onSceneEnter?.(ctx);
    }
  }

  notifySceneExit(
    ctx: RuntimeSceneLifecycleContext<TScene>,
    systems: readonly RuntimeSystem<TScene>[],
  ): void {
    for (let i = systems.length - 1; i >= 0; i -= 1) {
      const system = systems[i];
      if (!system) continue;
      system.onSceneExit?.(ctx);
    }
  }
}
