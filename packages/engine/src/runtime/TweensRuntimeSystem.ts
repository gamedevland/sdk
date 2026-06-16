import { RuntimeSystemKey } from './RuntimeSystemKey';

import type { RuntimeSystem, RuntimeUpdateContext } from './types';

export class TweensRuntimeSystem implements RuntimeSystem {
  readonly key = RuntimeSystemKey.Tweens;
  readonly phase = 'tweens';

  update(dt: number, ctx: RuntimeUpdateContext): void {
    ctx.engine.tweens.tick(dt);
  }
}
