import { PositionProperty } from '../properties/PositionProperty';

import { DimensionParser } from './DimensionParser';

import type { ScreenManager } from '../../screen/ScreenManager';

/**
 * Public utility to apply position semantics to a native view, mirroring
 * the engine's PositionProperty logic. Intended for runtime use outside
 * of the layout build pipeline (e.g., in components responding to resize).
 */
export class PositionApplier {
  private readonly parser: DimensionParser;
  private readonly position: PositionProperty;

  constructor(
    private readonly root: unknown,
    private readonly screen: ScreenManager,
  ) {
    this.parser = new DimensionParser(
      () => this.screen.getVirtualSize().width,
      () => this.screen.getVirtualSize().height,
    );
    this.position = new PositionProperty();
  }

  /**
   * Applies the provided position config to the given native view.
   * The config supports x/y, gx/gy, cx/cy, right/bottom and percentages.
   */
  apply(view: unknown, cfg: unknown): void {
    if (!view || !cfg) return;
    this.position.apply(view, cfg, {
      root: this.root,
      screen: this.screen,
      parse: (v: unknown, axis: 'w' | 'h') => this.parser.parse(v, axis),
    });
  }
}
