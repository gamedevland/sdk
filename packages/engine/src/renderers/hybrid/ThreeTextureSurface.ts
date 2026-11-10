import { CanvasSource, Texture } from 'pixi.js';
import { ACESFilmicToneMapping, WebGLRenderer } from 'three';
import { SchemaDecoder as S } from '../../validation';
import type { Camera, Scene } from 'three';

/** A component-owned, off-DOM Three canvas uploaded to Pixi only on render(). */
export class ThreeTextureSurface {
  private static readonly decoder = S.object({
    width: S.number({ min: 1 }),
    height: S.number({ min: 1 }),
    resolution: S.number({ min: 0.25, max: 2, defaultValue: 1 }),
    exposure: S.number({ min: 0.01, max: 10, defaultValue: 1 }),
  });
  private readonly renderer: WebGLRenderer;
  private readonly source: CanvasSource;
  readonly texture: Texture;
  private disposed = false;
  private width = 0;
  private height = 0;
  private resolution = 0;

  constructor(options: unknown) {
    const settings = S.decode(options, ThreeTextureSurface.decoder, 'ThreeTextureSurface');
    this.renderer = new WebGLRenderer({
      alpha: true, antialias: true, preserveDrawingBuffer: true,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = settings.exposure;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(Math.max(1, Math.round(settings.width * settings.resolution)), Math.max(1, Math.round(settings.height * settings.resolution)), false);
    this.source = new CanvasSource({
      resource: this.renderer.domElement, resolution: settings.resolution,
      autoDensity: false, alphaMode: 'premultiplied-alpha',
    });
    this.texture = new Texture({ source: this.source });
    this.width = settings.width;
    this.height = settings.height;
    this.resolution = settings.resolution;
  }

  resize(width: number, height: number, resolution = this.resolution): void {
    this.assertActive();
    const settings = S.decode({ width, height, resolution }, ThreeTextureSurface.decoder, 'ThreeTextureSurface.resize');
    if (width === this.width && height === this.height && resolution === this.resolution) return;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(Math.max(1, Math.round(settings.width * settings.resolution)), Math.max(1, Math.round(settings.height * settings.resolution)), false);
    this.source.resize(this.renderer.domElement.width / settings.resolution, this.renderer.domElement.height / settings.resolution, settings.resolution);
    this.texture.update();
    this.width = width;
    this.height = height;
    this.resolution = resolution;
  }

  render(scene: Scene, camera: Camera): void {
    this.assertActive();
    this.renderer.render(scene, camera);
    this.source.update();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.texture.destroy(true);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.width = 1;
    this.renderer.domElement.height = 1;
  }

  private assertActive(): void {
    if (this.disposed) throw new Error('ThreeTextureSurface is disposed');
  }
}
