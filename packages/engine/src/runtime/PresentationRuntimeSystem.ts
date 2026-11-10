import type { RuntimeSystem, RuntimeUpdateContext } from './types';
/** Presentation is the final simulation phase before renderer submission. */
export class PresentationRuntimeSystem implements RuntimeSystem {
  readonly key = 'presentation';
  readonly phase = 'presentation';
  update(dt: number, ctx: RuntimeUpdateContext): void {
    ctx.engine.presentation.tick(dt, ctx.engine.getActiveLayout());
  }
}
