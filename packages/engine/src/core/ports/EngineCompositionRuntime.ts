import type { CommandRuntime } from './CommandRuntime';
import type { InputRuntime } from './InputRuntime';
import type { PhysicsRuntime } from './PhysicsRuntime';
import type { PrefabRuntime } from './PrefabRuntime';
import type { SceneManagerRuntime } from './SceneManagerRuntime';

export interface EngineCompositionRuntime
  extends CommandRuntime, InputRuntime, PrefabRuntime, SceneManagerRuntime, PhysicsRuntime {
  readonly rendering: import('../../rendering/types').RenderRuntime;
}
