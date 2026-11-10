/**
 * Display node wrapping a Pixi Graphics. Used for vector shapes (Rect alias).
 *
 * Keeps full node API compatibility (components, actions, input, tweens, events).
 */
import * as PIXI from 'pixi.js';

import { NodeBase } from './NodeBase';

import type { DisplayNode } from './types';
import type { AssetManager } from '../../assets/AssetManager';
import type { ElementConfig } from '@engine/renderers/pixi/types';

export class Graphics extends NodeBase {
  constructor(private readonly graphics: PIXI.Graphics) {
    super(graphics);
    this.setKind('graphics');
  }

  /** Factory for layout element of type 'Graphics'. */
  static create(_id: string, _cfg: ElementConfig, _ctx: { assets: AssetManager }): DisplayNode {
    return new Graphics(new PIXI.Graphics());
  }

  override get view(): PIXI.Graphics {
    return this.graphics;
  }
}

export default Graphics;
