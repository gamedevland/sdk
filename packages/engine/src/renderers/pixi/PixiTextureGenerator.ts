import type { Renderer } from 'pixi.js';

/** Renderer-specific texture baking for node-owned visual resources. */
export class PixiTextureGenerator {
  constructor(private readonly getRenderer: () => Pick<Renderer, 'generateTexture'>) {}

  generateTexture(options: Parameters<Renderer['generateTexture']>[0]): ReturnType<Renderer['generateTexture']> {
    return this.getRenderer().generateTexture(options);
  }
}
