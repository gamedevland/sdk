/**
 * Contract for a layout property applier that mutates a Pixi view based on config.
 *
 * Implementations should be side-effect-only and tolerate missing fields. The
 * pipeline invokes multiple properties in a defined order to realize the final
 * visual state of a node.
 */
import type { ScreenManager } from '../../screen/ScreenManager';

type Axis = 'w' | 'h';

export interface NodePropertyContext {
  getAsset?: (id: string) => unknown;
  getLocale?: () => string;
  localize?: (key: string, params?: Readonly<Record<string, string | number>>) => string;
  root: unknown;
  screen: ScreenManager;
  parse?: (v: unknown, axis: Axis) => number | undefined;
}

export interface NodeProperty {
  apply(view: unknown, cfg: unknown, ctx: NodePropertyContext): void;
}
