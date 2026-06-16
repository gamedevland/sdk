import { DisplacementFilter, Filter, Sprite as PixiSprite } from 'pixi.js';

import { SystemServices } from '@engine/di';
import { SchemaDecoder } from '@engine/validation';

import { BaseTypedComponent } from './BaseTypedComponent';

import type { TextureAssetResolver } from '../assets/TextureAssetResolver';
import type { NodeBase } from '../nodes/NodeBase';
import type { Decoder, InferDecoded } from '@engine/validation';
import type { Texture } from 'pixi.js';

const ConfigDecoder = SchemaDecoder.object({
  noiseAssetId: SchemaDecoder.string({ nonEmpty: true }),
  strengthX: SchemaDecoder.number({ defaultValue: 12 }),
  strengthY: SchemaDecoder.number({ defaultValue: 10 }),
  noiseScaleX: SchemaDecoder.number({ defaultValue: 8, min: 0 }),
  noiseScaleY: SchemaDecoder.number({ defaultValue: 8, min: 0 }),
  driftXPerSecond: SchemaDecoder.number({ defaultValue: 32 }),
  driftYPerSecond: SchemaDecoder.number({ defaultValue: 24 }),
  enabled: SchemaDecoder.boolean({ defaultValue: true }),
});

type DisplacementFilterComponentConfig = InferDecoded<typeof ConfigDecoder>;

export class DisplacementFilterComponent extends BaseTypedComponent<
  DisplacementFilterComponentConfig,
  NodeBase
> {
  protected override readonly configDecoder: Decoder<DisplacementFilterComponentConfig> =
    ConfigDecoder;

  private noiseSprite: PixiSprite | undefined;
  private filter: DisplacementFilter | undefined;

  protected override onEnable(): void {
    if (!this.config.enabled || this.filter !== undefined) {
      return;
    }

    const texture = this.resolveNoiseTexture();
    texture.source.addressMode = 'repeat';

    const noiseSprite = new PixiSprite(texture);
    noiseSprite.renderable = false;
    noiseSprite.scale.set(this.config.noiseScaleX, this.config.noiseScaleY);
    this.node.view.parent?.addChild(noiseSprite);

    const filter = new DisplacementFilter({
      sprite: noiseSprite,
      scale: {
        x: this.config.strengthX,
        y: this.config.strengthY,
      },
    });

    this.noiseSprite = noiseSprite;
    this.filter = filter;
    this.node.view.filters = [...this.readCurrentFilters(), filter];
  }

  protected override onDisable(): void {
    this.detachFilter();
  }

  protected override onUpdate(dt: number): void {
    const noiseSprite = this.noiseSprite;
    if (noiseSprite === undefined) {
      return;
    }

    noiseSprite.x += this.config.driftXPerSecond * dt;
    noiseSprite.y += this.config.driftYPerSecond * dt;
  }

  override onDetach(): void {
    this.detachFilter();
    super.onDetach();
  }

  private resolveNoiseTexture(): Texture {
    return this.node.engine.di
      .get<TextureAssetResolver>(SystemServices.TextureAssetResolver)
      .getRequiredTexture(this.config.noiseAssetId);
  }

  private detachFilter(): void {
    const filter = this.filter;
    const noiseSprite = this.noiseSprite;
    this.filter = undefined;
    this.noiseSprite = undefined;

    if (filter !== undefined) {
      this.node.view.filters = this.readCurrentFilters().filter((item) => item !== filter);
    }

    noiseSprite?.removeFromParent();
    noiseSprite?.destroy();
  }

  private readCurrentFilters(): readonly Filter[] {
    const filters = this.node.view.filters;
    if (filters === undefined) {
      return [];
    }
    if (filters instanceof Filter) {
      return [filters];
    }
    return Array.from(filters);
  }
}
