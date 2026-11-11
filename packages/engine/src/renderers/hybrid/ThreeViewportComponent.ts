import { OrthographicCamera, PerspectiveCamera, Scene } from 'three';
import { BaseComponent } from '../../layouts/components/BaseComponent';
import { LayoutIntegrator } from '../../layouts/core/LayoutIntegrator';
import { SceneLayout } from '../../layouts/scene/SceneLayout';
import { Sprite } from '../../layouts/nodes/Sprite';
import { ThreeGroup } from '../three/ThreeGroup';
import { ThreeNode } from '../three/ThreeNode';
import { ThreeProperties } from '../three/ThreeProperties';
import { ThreeCameraProjection } from '../three/ThreeCameraProjection';
import { SchemaDecoder as S } from '../../validation';
import { ThreeTextureSurface } from './ThreeTextureSurface';

/** Internal owner of the embedded graph, offscreen renderer and presentation subscription. */
export class ThreeViewportComponent extends BaseComponent<Sprite> {
  protected readonly nodeType = Sprite;
  private static readonly dimensions = {
    width: S.number({ min: 1 }),
    height: S.number({ min: 1 }),
    resolution: S.optional(S.number({ min: 0.25, max: 2 })),
  };
  private static readonly sizeDecoder = S.strictObject(ThreeViewportComponent.dimensions);
  private static readonly decoder = S.object({
    ...ThreeViewportComponent.dimensions,
    exposure: S.optional(S.number({ min: 0.01, max: 10 })),
    sceneLayout: S.string({ nonEmpty: true }),
    camera: S.string({ nonEmpty: true }),
    renderMode: S.optional(S.enumOf(['on-demand', 'always'])),
  });
  private readonly settings;
  readonly surface: ThreeTextureSurface;
  private readonly scene = new Scene();
  private graph: SceneLayout | undefined;
  private camera: PerspectiveCamera | OrthographicCamera | undefined;
  private width: number;
  private height: number;
  private dirty = true;

  constructor(options: unknown) {
    super();
    this.settings = S.decode(options, ThreeViewportComponent.decoder, 'ThreeViewport.props');
    this.width = this.settings.width;
    this.height = this.settings.height;
    this.surface = new ThreeTextureSurface(this.settings);
    this.ownDisposer(() => this.surface.dispose());
  }

  get world(): SceneLayout {
    if (!this.graph || this.isDetaching) throw new Error('ThreeViewport world is not prepared');
    return this.graph;
  }

  async prepare(): Promise<void> {
    const built = await this.awaitComponentScopeResource(
      new LayoutIntegrator().loadAndBuild(this.node.engine, this.settings.sceneLayout, undefined, {
        createRoot: () => new ThreeGroup(),
        createProperties: () => new ThreeProperties(),
      }),
      result => result.root.destroy(),
    );
    if (!built) throw new Error('ThreeViewport disposed during preparation');
    this.graph = SceneLayout.fromBuildResult(this.node.engine, built);
    const camera = this.graph.requireNode(this.settings.camera, ThreeNode).view;
    if (!(camera instanceof PerspectiveCamera) && !(camera instanceof OrthographicCamera)) {
      throw new Error('ThreeViewport camera must name a PerspectiveCamera or OrthographicCamera node');
    }
    this.camera = camera;
    this.scene.add(built.root.requireNode(ThreeGroup).view);
    this.updateCamera();
  }

  invalidate(): void {
    this.scopeSignal.throwIfAborted();
    this.dirty = true;
  }

  resize(width: number, height: number, resolution?: number): void {
    const size = S.decode({ width, height, resolution }, ThreeViewportComponent.sizeDecoder, 'ThreeViewport.resize');
    this.surface.resize(size.width, size.height, size.resolution);
    this.width = size.width;
    this.height = size.height;
    this.updateCamera();
    this.invalidate();
  }

  protected override onReady(): void {
    this.world.activate();
    this.onPresentation(() => this.present(), { phase: 'ui' });
    this.present();
  }

  protected override onUpdate(dt: number): void {
    this.world.update(dt);
  }

  private updateCamera(): void {
    if (this.camera) ThreeCameraProjection.update(this.camera, this.width / this.height);
  }

  private present(): void {
    if (!this.camera) throw new Error('ThreeViewport camera is not prepared');
    if (!this.dirty && this.settings.renderMode !== 'always') return;
    this.surface.render(this.scene, this.camera);
    this.dirty = false;
  }

  override async onDetach(): Promise<void> {
    const errors: unknown[] = [];
    try { super.onDetach(); } catch (error) { errors.push(error); }
    try { await this.graph?.destroy(); } catch (error) { errors.push(error); }
    this.scene.clear();
    this.graph = undefined;
    this.camera = undefined;
    if (errors.length) throw new AggregateError(errors, 'ThreeViewport disposal failed');
  }
}
