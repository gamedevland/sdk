import { Application, Container as NativeContainer, WebGLRenderer } from "pixi.js";
import { RendererWarmup } from "../../rendering/RendererWarmup";
import { PixiScenePreparer } from "./PixiScenePreparer";
import { Container } from "../../layouts/nodes/Container";
import { NodeBase as PixiNode } from "../../layouts/nodes/NodeBase";
import { NodeHitTester } from "./NodeHitTester";
import { NodePropertyApplier } from "../../layouts/properties/NodePropertyApplier";
import { DisplayPipeline } from "../../layouts/display/DisplayPipeline";
import { PixiRenderPipeline } from "./PixiRenderPipeline";
import type { TextureAssetResolver } from "../../layouts/assets/TextureAssetResolver";
import type { ParticlesManager } from "../../particles/ParticlesManager";
import type { NodeBase } from "../../layouts/NodeBase";
import type { BuildContext } from "../../layouts/build/BuildTypes";
import type { SceneLayout } from "../../layouts/scene/SceneLayout";
import type { RenderRuntime } from "../../rendering/types";
import type { ScreenConfig, ScreenStateSnapshot } from "../../screen/types";
export class PixiRuntime implements RenderRuntime {
  readonly mode = 'pixi';
  private initialized = false;
  private disposed = false;
  private warmup: RendererWarmup | undefined;
  get canvases(): readonly HTMLCanvasElement[] {
    return [this.canvas];
  }
  readonly app = new Application();
  private readonly pipeline: PixiRenderPipeline;
  readonly root: Container;
  constructor(
    config: ScreenConfig,
    private readonly particles: ParticlesManager,
    private readonly transparent = false,
    private readonly textures?: TextureAssetResolver,
  ) {
    this.pipeline = new PixiRenderPipeline(this.app, config);
    this.root = new Container(this.pipeline.getSceneRoot());
  }
  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }
  get resolution(): number {
    return this.app.renderer.resolution;
  }
  async init(background: string): Promise<void> {
    if (this.disposed) throw new Error('Pixi runtime is disposed');
    if (this.initialized) return;
    await this.app.init({
      background: this.transparent ? '#000000' : background,
      backgroundAlpha: this.transparent ? 0 : 1,
      preference: 'webgl',
      antialias: true,
      autoStart: false,
    });
    if (this.disposed) {
      this.app.destroy(true, { children: true });
      throw new Error('Pixi runtime disposed during initialization');
    }
    this.initialized = true;
    this.app.ticker.stop();
  }
  resize(snapshot: ScreenStateSnapshot, resolution: number): void {
    this.app.renderer.resize(snapshot.canvas.width, snapshot.canvas.height, resolution);
    this.canvas.style.width = `${snapshot.viewport.width}px`;
    this.canvas.style.height = `${snapshot.viewport.height}px`;
    this.pipeline.sync(snapshot);
  }
  createRoot(): Container {
    return new Container(new NativeContainer());
  }
  createProperties(ctx: BuildContext, root: NodeBase): NodePropertyApplier {
    return new NodePropertyApplier(
      ctx,
      new DisplayPipeline({
        root: root.requireNode(PixiNode).view,
        screen: ctx.screen,
      }),
    );
  }
  createHitTester(getLayout: () => SceneLayout | undefined): NodeHitTester {
    return new NodeHitTester(getLayout);
  }
  prepareScene(_layout: SceneLayout, _cameraPath?: string): void {}
  renderFrame(): void {
    if (!this.warmup) this.pipeline.renderFrame();
  }
  async warmupScene(): Promise<void> {
    if (!this.initialized || this.disposed) throw new Error("Pixi runtime is not active");
    this.assertContextActive();
    if (this.warmup) throw new Error("Pixi warmup is already running");
    const warmup = new RendererWarmup(this.canvas, "Pixi");
    this.warmup = warmup;
    try {
      // Traverse hidden controls and upload in bounded, cancellable timer batches.
      const preparer = new PixiScenePreparer(this.app.renderer);
      await warmup.wait(() => preparer.prepare(this.pipeline.getSceneRoot(), warmup.signal));
      warmup.signal.throwIfAborted();
      this.assertContextActive();
      if (!this.disposed) this.pipeline.renderFrame();
      this.assertContextActive();
    } finally {
      warmup.dispose();
      if (this.warmup === warmup) this.warmup = undefined;
    }
  }
  private assertContextActive(): void {
    const renderer = this.app.renderer;
    if (renderer instanceof WebGLRenderer && renderer.gl.isContextLost()) {
      throw new Error("Pixi warmup requires an active WebGL context");
    }
  }
  getWarmupStage(): string | undefined { return this.warmup ? "pixi:upload-resources" : undefined; }
  tick(dt: number): void {
    this.particles.tick(dt);
  }
  cleanup(root: NodeBase): void {
    this.warmup?.cancel();
    this.particles.destroyInSubtree(root.requireNode(PixiNode).view);
  }
  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.warmup?.cancel();
    const errors: unknown[] = [];
    const operations = [
      () => this.particles.destroyAll(),
      () => {
        if (this.initialized) this.app.destroy(true, { children: true });
      },
      () => this.pipeline.destroy(),
      () => this.textures?.destroy(),
    ];
    for (const operation of operations) {
      try {
        operation();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'Pixi renderer disposal failed');
  }
}
