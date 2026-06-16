import { Texture } from 'pixi.js';

import type { AssetManager } from '@engine/assets';

export class SpdTextureResolver {
  private readonly cache = new Map<string, Texture>();

  constructor(private readonly assets: AssetManager) {}

  resolveRequired(assetId: string): Texture {
    const cached = this.cache.get(assetId);
    if (cached !== undefined) {
      return cached;
    }

    const bitmap = this.assets.getRequired<ImageBitmap>(assetId, 'SpdTextureResolver.resolveRequired');
    const texture = Texture.from(bitmap);
    this.cache.set(assetId, texture);
    return texture;
  }
}
