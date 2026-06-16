/**
 * Display node wrapping a Pixi Sprite. Optionally binds texture from an asset id.
 *
 * If `props.asset` is provided in the element config and resolves to an ImageBitmap
 * in the AssetManager, the sprite's texture is initialized from it.
 */
import * as PIXI from 'pixi.js';

import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { ElementPropsDecoder } from './internal/ElementPropsDecoder';
import { NodeBase } from './NodeBase';

import type { SpriteNode, DisplayNode } from './types';
import type { AssetManager } from '../../assets/AssetManager';
import type { AssetId } from '../../assets/types';
import type { ElementConfig } from '../types';

export interface SpriteTextureSize {
  readonly width: number;
  readonly height: number;
}

export class Sprite extends NodeBase implements SpriteNode {
  constructor(private readonly sprite: PIXI.Sprite) {
    super(sprite);
    this.setKind('sprite');
  }
  /** Factory for layout element of type 'Sprite'; reads props.asset string for texture. */
  static create(_id: string, cfg: ElementConfig, ctx: { assets: AssetManager }): DisplayNode {
    const sprite = new PIXI.Sprite();
    const propsDecoder = new ElementPropsDecoder('Sprite.create');
    const props = propsDecoder.readProps(cfg);
    const assetId = propsDecoder.readOptionalStringProp(props, 'asset');
    if (assetId) {
      const bmp = ctx.assets.get<ImageBitmap>(assetId);
      if (bmp) sprite.texture = PIXI.Texture.from(bmp);
    }
    return new Sprite(sprite);
  }

  override get view(): PIXI.Sprite {
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
      details: { method: 'Sprite.setTexture' },
    });
  }

  setTextureByAssetId(assetId: AssetId): this {
    const bitmap = this.engine.assets.getRequired<ImageBitmap>(assetId, 'Sprite.setTextureByAssetId');
    return this.setTexture(bitmap);
  }

  getTextureSize(source?: string): SpriteTextureSize {
    const width = this.view.texture.width;
    const height = this.view.texture.height;
    if (width > 0 && height > 0) {
      return { width, height };
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.LayoutMissingRequired,
      subsystem: EngineSubsystem.Layout,
      message: 'Sprite texture size is not initialized',
      details: {
        method: 'Sprite.getTextureSize',
        nodeId: this.id,
        width,
        height,
        ...(source === undefined ? {} : { source }),
      },
    });
  }

  protected override applyAnchor(anchorX: number, anchorY: number): this {
    this.view.anchor.set(anchorX, anchorY);
    return this;
  }
}
