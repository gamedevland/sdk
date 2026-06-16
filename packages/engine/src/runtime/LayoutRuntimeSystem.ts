import { RuntimeSystemKey } from './RuntimeSystemKey';

import type { RuntimeSystem, RuntimeUpdateContext } from './types';

export class LayoutRuntimeSystem implements RuntimeSystem {
  readonly key = RuntimeSystemKey.Layout;
  readonly phase = 'layout';

  update(dt: number, ctx: RuntimeUpdateContext): void {
    const activeScene = ctx.activeScene;
    if (!activeScene) {
      return;
    }
    const layout = activeScene.getLayout?.();
    if (!layout) {
      return;
    }
    layout.update(dt);
  }
}
