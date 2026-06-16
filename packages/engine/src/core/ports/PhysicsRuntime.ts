import type SceneManager from '@engine/scenes/SceneManager';
import type { SceneRuntime } from '@engine/scenes/SceneRuntime';

export interface PhysicsRuntime extends SceneRuntime {
  readonly scenes: SceneManager;
}
