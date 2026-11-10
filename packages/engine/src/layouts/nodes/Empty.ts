/**
 * Logical placeholder node without a native view. Useful for grouping and anchors.
 *
 * Can serve as an attachment point for components/actions without rendering anything.
 */
import * as PIXI from 'pixi.js';

import { NodeBase } from './NodeBase';

import type { DisplayNode } from './types';
import type { AssetManager } from '../../assets/AssetManager';
import type { ElementConfig } from '@engine/renderers/pixi/types';

export class Empty extends NodeBase {
  constructor() {
    super(new PIXI.Container());
  }
  /** Factory for layout element of type 'Empty'. */
  static create(_id: string, _cfg: ElementConfig, _ctx: { assets: AssetManager }): DisplayNode {
    return new Empty();
  }
}
