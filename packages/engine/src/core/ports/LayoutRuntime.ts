import type { GameConfig } from '../GameConfig';
import type { SceneRuntime } from '@engine/scenes/SceneRuntime';

export interface LayoutRuntime extends SceneRuntime {
  readonly config: { layouts?: GameConfig['layouts'] };
}
