import { Texture } from 'pixi.js';

import type { AssetManager } from '@engine/assets';

export class TextureAssetResolver {
  private readonly cache = new Map<string, Texture>();

  constructor(private readonly assets: AssetManager) {}

  getRequiredTexture(assetId: string): Texture {
    const cached = this.cache.get(assetId);
    if (cached !== undefined) {
      return cached;
    }
    const bitmap = this.assets.getRequired<ImageBitmap>(assetId, 'TextureAssetResolver.getRequiredTexture');
    const texture = Texture.from(bitmap);
    this.cache.set(assetId, texture);
    return texture;
  }
}
