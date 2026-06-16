import { RuntimeSystemKey } from './RuntimeSystemKey';

import type { RuntimeSystem, RuntimeUpdateContext } from './types';

export class ParticlesRuntimeSystem implements RuntimeSystem {
  readonly key = RuntimeSystemKey.Particles;
  readonly phase = 'particles';

  update(dt: number, ctx: RuntimeUpdateContext): void {
    ctx.engine.particles.tick(dt);
  }
}
