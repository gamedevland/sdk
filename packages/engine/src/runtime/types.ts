import type { RuntimeSystemPhase } from './RuntimeSystemPhase';
import type { PhysicsRuntime } from '@engine/core';
import type { Scene } from '@engine/scenes/SceneManager';

/**
 * Per-frame runtime context shared with every runtime system update.
 */
export interface RuntimeUpdateContext<TScene extends Scene = Scene> {
  readonly engine: PhysicsRuntime;
  readonly activeScene: TScene | null;
  readonly frame: number;
}

/**
 * Lifecycle context passed to scene transition hooks.
 */
export interface RuntimeSceneLifecycleContext<TScene extends Scene = Scene> {
  readonly engine: PhysicsRuntime;
  readonly scene: TScene;
}

/**
 * Contract implemented by all scheduler-managed runtime systems.
 */
export interface RuntimeSystem<TScene extends Scene = Scene> {
  readonly key: string;
  readonly phase: RuntimeSystemPhase;

  update(dt: number, ctx: RuntimeUpdateContext<TScene>): void;
  onSceneEnter?(ctx: RuntimeSceneLifecycleContext<TScene>): void;
  onSceneExit?(ctx: RuntimeSceneLifecycleContext<TScene>): void;
  onPause?(): void;
  onResume?(): void;
}
