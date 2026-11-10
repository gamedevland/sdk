import * as PIXI from 'pixi.js';

import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { ElementPropsDecoder } from './internal/ElementPropsDecoder';
import { NodeBase } from './NodeBase';

import type { DisplayNode, TilingSpriteNode } from './types';
import type { AssetManager } from '../../assets/AssetManager';
import type { AssetId } from '../../assets/types';
import type { ElementConfig } from '@engine/renderers/pixi/types';

export class TilingSprite extends NodeBase implements TilingSpriteNode {
  constructor(private readonly sprite: PIXI.TilingSprite) {
    super(sprite);
    this.setKind('tilingSprite');
  }

  static create(_id: string, cfg: ElementConfig, ctx: { assets: AssetManager }): DisplayNode {
    const propsDecoder = new ElementPropsDecoder('TilingSprite.create');
    const props = propsDecoder.readProps(cfg);
    const assetId = propsDecoder.readOptionalStringProp(props, 'asset');
    const bmp = assetId ? ctx.assets.get<ImageBitmap>(assetId) : undefined;
    const texture = bmp ? PIXI.Texture.from(bmp) : PIXI.Texture.WHITE;
    const sprite = new PIXI.TilingSprite({
      texture,
      width: 1,
      height: 1,
    });
    return new TilingSprite(sprite);
  }

  override get view(): PIXI.TilingSprite {
    return this.sprite;
  }

  setTexture(texture: PIXI.Texture | ImageBitmap): this {
    if (texture instanceof PIXI.Texture) {
      this.view.texture = texture;
      return this;
    }
    if (typeof ImageBitmap !== 'undefined' && texture instanceof ImageBitmap) {
      this.view.texture = PIXI.Texture.from(texture);
      return this;
    }
    throw EngineErrorFactory.invalidInput({
      code: EngineErrorCode.LayoutInvalidConfig,
      subsystem: EngineSubsystem.Layout,
      message: 'Texture must be PIXI.Texture or ImageBitmap',
      details: { method: 'TilingSprite.setTexture' },
    });
  }

  setTextureFromCanvas(canvas: HTMLCanvasElement): this {
    return this.setTexture(PIXI.Texture.from(canvas));
  }

  setTextureByAssetId(assetId: AssetId): this {
    const bitmap = this.engine.assets.getRequired<ImageBitmap>(
      assetId,
      'TilingSprite.setTextureByAssetId',
    );
    return this.setTexture(bitmap);
  }

  protected override applyAnchor(anchorX: number, anchorY: number): this {
    this.view.anchor.set(anchorX, anchorY);
    return this;
  }
}
