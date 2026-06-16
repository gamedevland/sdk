/**
 * Thin facade that exposes DisplayManager and selected screen info to callers.
 *
 * Keeps consumers decoupled from concrete DisplayManager while still providing
 * convenient accessors for root container and screen information.
 */
import { DisplayManager } from './DisplayManager';

import type { DisplayContext } from './types';
import type { ScreenManager } from '../../screen/ScreenManager';

export class DisplayPipeline {
  private manager: DisplayManager;

  constructor(private ctx: DisplayContext) {
    this.manager = new DisplayManager(ctx);
  }

  /** Apply display configuration to a view. */
  apply(view: unknown, display: unknown): void {
    this.manager.apply(view, display);
  }

  /** Root container used for relative positioning calculations. */
  getRoot(): unknown {
    return this.ctx.root;
  }

  /** Current virtual screen size. */
  getScreen(): { width: number; height: number } {
    const sm: ScreenManager = this.ctx.screen;
    return { width: sm.getVirtualSize().width, height: sm.getVirtualSize().height };
  }

  /** Access to screen manager for advanced consumers. */
  getScreenManager(): ScreenManager {
    return this.ctx.screen;
  }
}
