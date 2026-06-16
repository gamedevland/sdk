import { Container, RenderTexture, Sprite, Texture, UPDATE_PRIORITY } from 'pixi.js';

import type { ScreenConfig, ScreenStateSnapshot } from '@engine/screen';
import type { Application, Ticker } from 'pixi.js';

export class EngineRenderPipeline {
  private readonly sceneRoot = new Container();
  private readonly presentRoot = new Container();
  private readonly presentSprite = new Sprite(Texture.EMPTY);
  private renderTexture: RenderTexture | undefined;
  private readonly renderBound = (_ticker: Ticker) => this.renderFrame();

  constructor(
    private readonly app: Application,
    private readonly screenConfig: ScreenConfig,
  ) {
    this.presentRoot.addChild(this.presentSprite);
  }

  init(snapshot: ScreenStateSnapshot): void {
    this.sync(snapshot);
    this.app.ticker.add(this.renderBound, this, UPDATE_PRIORITY.LOW);
  }

  destroy(): void {
    this.app.ticker.remove(this.renderBound, this);
    this.destroyRenderTexture();
    this.presentSprite.texture = Texture.EMPTY;
    this.presentRoot.destroy({ children: true });
    this.sceneRoot.destroy({ children: false });
  }

  getSceneRoot(): Container {
    return this.sceneRoot;
  }

  sync(snapshot: ScreenStateSnapshot): void {
    if (this.isLowResolutionPassEnabled()) {
      this.ensureRenderTexture(snapshot);
    } else {
      this.destroyRenderTexture();
    }

    this.presentSprite.position.set(0, 0);
    this.presentSprite.width = snapshot.canvas.width;
    this.presentSprite.height = snapshot.canvas.height;
  }

  renderFrame(): void {
    if (!this.isLowResolutionPassEnabled()) {
      this.app.renderer.render({
        container: this.sceneRoot,
        clear: true,
      });
      return;
    }

    const renderTexture = this.renderTexture;
    if (renderTexture === undefined) {
      this.app.renderer.render({
        container: this.sceneRoot,
        clear: true,
      });
      return;
    }

    this.app.renderer.render({
      container: this.sceneRoot,
      target: renderTexture,
      clear: true,
    });
    this.app.renderer.render({
      container: this.presentRoot,
      clear: true,
    });
  }

  private ensureRenderTexture(snapshot: ScreenStateSnapshot): void {
    const width = snapshot.canvas.width;
    const height = snapshot.canvas.height;
    const resolution = this.resolveRenderResolution();

    if (
      this.renderTexture !== undefined &&
      this.renderTexture.width === width &&
      this.renderTexture.height === height &&
      this.renderTexture.source.resolution === resolution
    ) {
      return;
    }

    this.destroyRenderTexture();
    this.renderTexture = RenderTexture.create({
      width,
      height,
      resolution,
      antialias: false,
      autoGenerateMipmaps: false,
      scaleMode: 'linear',
    });
    this.presentSprite.texture = this.renderTexture;
  }

  private destroyRenderTexture(): void {
    if (this.renderTexture === undefined) {
      return;
    }
    this.renderTexture.destroy(true);
    this.renderTexture = undefined;
    this.presentSprite.texture = Texture.EMPTY;
  }

  private resolveRenderResolution(): number {
    const factor = this.screenConfig.render?.scaleFactor;
    if (factor === undefined || !Number.isFinite(factor) || factor <= 0 || factor >= 1) {
      return 1;
    }
    return factor;
  }

  private isLowResolutionPassEnabled(): boolean {
    return this.resolveRenderResolution() < 1;
  }
}
