import { RuntimeSystemKey } from './RuntimeSystemKey';

import type { RuntimeSystem, RuntimeUpdateContext } from './types';
import type { BaseScene } from '@engine/scenes/BaseScene';

export class PhysicsRuntimeSystem implements RuntimeSystem<BaseScene> {
  readonly key = RuntimeSystemKey.Physics;
  readonly phase = 'physics';

  update(dt: number, ctx: RuntimeUpdateContext<BaseScene>): void {
    const scene = ctx.activeScene;
    if (!scene) {
      return;
    }
    scene.tickPhysicsServicesForRuntimeScheduler(dt);
  }
}
