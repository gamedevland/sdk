import { RuntimeSystemKey } from './RuntimeSystemKey';

import type { RuntimeSystem, RuntimeUpdateContext } from './types';
import type { BaseScene } from '@engine/scenes/BaseScene';

export class SceneServicesRuntimeSystem implements RuntimeSystem<BaseScene> {
  readonly key = RuntimeSystemKey.SceneServices;
  readonly phase = 'scene';

  update(dt: number, ctx: RuntimeUpdateContext<BaseScene>): void {
    const scene = ctx.activeScene;
    if (!scene) {
      return;
    }
    scene.tickSceneServicesForRuntimeScheduler(dt);
  }
}
