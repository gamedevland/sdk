/**
 * Applies display-related properties to native Pixi views using a registry of properties.
 * Uses DimensionParser to support absolute and percentage-based sizing.
 *
 * The manager delegates concrete property handling to registered property appliers,
 * ensuring a deterministic order (size → scale → style → anchor → pivot → position).
 */
import { DimensionParser } from './DimensionParser';
import { PropertyRegistry } from './PropertyRegistry';

import type { DisplayContext } from './types';
import type { ScreenManager } from '../../screen/ScreenManager';

export class DisplayManager {
  private props: Array<{
    apply: (
      view: unknown,
      cfg: unknown,
      ctx: {
        root: unknown;
        screen: ScreenManager;
        parse: (v: unknown, axis: 'w' | 'h') => number | undefined;
        getAsset: (id: string) => unknown;
      },
    ) => void;
  }>;
  private parser: DimensionParser;

  constructor(
    private baseCtx: DisplayContext,
    propertyRegistry: PropertyRegistry = PropertyRegistry.createDefault(),
  ) {
    const sm: ScreenManager = baseCtx.screen;
    this.parser = new DimensionParser(
      () => sm.getVirtualSize().width,
      () => sm.getVirtualSize().height,
    );
    // Pre-sort and cache properties by priority to ensure deterministic application order
    this.props = propertyRegistry.getAllOrdered();
  }

  /**
   * Apply all display properties from layout config to a native view.
   * @param {any} view — Native Pixi container/sprite/text object.
   * @param {any} display — Display section of the layout node config.
   */
  apply(view: unknown, display: unknown): void {
    if (!display || !view) return;
    for (const p of this.props)
      p.apply(view, display, {
        root: this.baseCtx.root,
        screen: this.baseCtx.screen,
        parse: (v: unknown, axis: 'w' | 'h') => this.parser.parse(v, axis),
        // Note: asset lookup can be wired here if display properties need it in future
        getAsset: (_id: string) => undefined,
      });
  }
}
