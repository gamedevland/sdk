/** Axis hint used for dimension parsing: 'w'idth or 'h'eight. */
export type Axis = 'w' | 'h';

import type { DimensionParser } from './DimensionParser';
import type { ScreenManager } from '../../screen/ScreenManager';

/** Context shared by display property appliers. */
export interface DisplayContext {
  root: unknown;
  screen: ScreenManager;
}

/** Extended context passed to property appliers including a parser. */
export interface PropertyCtx extends DisplayContext {
  parser: DimensionParser;
}

/** Contract for a display property applier. */
export interface DisplayProperty {
  apply(view: unknown, d: unknown, ctx: PropertyCtx): void;
}
