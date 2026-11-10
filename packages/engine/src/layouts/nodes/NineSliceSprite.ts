import { NineSliceSprite as NativeNineSliceSprite, Texture } from 'pixi.js';
import { SchemaDecoder as S } from '@engine/validation';
import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';
import { NodeBase } from './NodeBase';
import type { AssetManager } from '../../assets/AssetManager';
import type { ElementConfig } from '@engine/renderers/pixi/types';

/** A leaf image node whose authored corner pixels remain fixed while its center stretches. */
export class NineSliceSprite extends NodeBase {
  private static readonly decoder = S.object({
    asset: S.string({ nonEmpty: true }),
    leftWidth: S.number({ min: 0 }),
    rightWidth: S.number({ min: 0 }),
    topHeight: S.number({ min: 0 }),
    bottomHeight: S.number({ min: 0 }),
  });

  constructor(private readonly sprite: NativeNineSliceSprite) {
    super(sprite);
    this.setKind('nineSliceSprite');
  }

  static create(_id: string, cfg: ElementConfig, ctx: { assets: AssetManager }): NineSliceSprite {
    const props = S.decode(cfg.props, NineSliceSprite.decoder, 'NineSliceSprite.create');
    const bitmap = ctx.assets.getRequired<ImageBitmap>(props.asset, 'NineSliceSprite.create');
    const texture = Texture.from(bitmap);
    if (props.leftWidth + props.rightWidth >= texture.width || props.topHeight + props.bottomHeight >= texture.height)
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Nine-slice borders must leave a nonempty texture center',
        details: { asset: props.asset, width: texture.width, height: texture.height },
      });
    return new NineSliceSprite(new NativeNineSliceSprite({ texture, ...props }));
  }

  override get view(): NativeNineSliceSprite {
    return this.sprite;
  }

  setSize(width: number, height: number): this {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Nine-slice size must be finite and positive',
        details: { width, height },
      });
    this.sprite.setSize(width, height);
    return this;
  }

  protected override applyAnchor(x: number, y: number): this {
    this.sprite.anchor.set(x, y);
    return this;
  }
}
