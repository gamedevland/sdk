import {
  Scene,
  WebGLRenderer,
  Camera,
  OrthographicCamera,
  PerspectiveCamera,
  PCFShadowMap,
  NeutralToneMapping,
  ACESFilmicToneMapping,
  NoToneMapping,
} from "three";
import { ThreeRendererSettings } from "./ThreeRendererSettings";
import { ThreeCameraProjection } from './ThreeCameraProjection';
import { ThreeGroup } from "./ThreeGroup";
import { ThreeNode } from "./ThreeNode";
import { ThreeProperties } from "./ThreeProperties";
import { ThreeHitTester } from "./ThreeHitTester";
import { RendererWarmup } from "../../rendering/RendererWarmup";
import type { RenderRuntime } from "../../rendering/types";
import type { ScreenStateSnapshot } from "../../screen/types";
import type { SceneLayout } from "../../layouts/scene/SceneLayout";
export class ThreeRuntime implements RenderRuntime {
  readonly mode = "three";
  private disposed = false;
  private warmup: RendererWarmup | undefined;
  private warmupStage: string | undefined;
  get canvases(): readonly HTMLCanvasElement[] {
    return [this.canvas];
  }
  private backend: WebGLRenderer | undefined;
  readonly root = new ThreeGroup();
  readonly scene = new Scene();
  private camera: Camera | undefined;
  private snapshot: ScreenStateSnapshot | undefined;
  private currentResolution = 1;
  private readonly settings: ThreeRendererSettings;
  constructor(options: unknown = {}) {
    this.settings = new ThreeRendererSettings(options);
    this.scene.add(this.root.view);
  }
  private get renderer(): WebGLRenderer {
    if (!this.backend) throw new Error("Three renderer is not initialized");
    return this.backend;
  }
  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }
  get resolution(): number {
    return this.currentResolution;
  }
  async init(background: string): Promise<void> {
    if (this.disposed) throw new Error("Three runtime is disposed");
    if (this.backend) return;
    this.backend = new WebGLRenderer({ antialias: true });
    this.backend.setClearColor(background);
    const settings = this.settings.values;
    this.backend.shadowMap.enabled = settings.shadows ?? false;
    this.backend.shadowMap.type = PCFShadowMap;
    this.backend.toneMapping =
      settings.toneMapping === "neutral"
        ? NeutralToneMapping
        : settings.toneMapping === "aces"
          ? ACESFilmicToneMapping
          : NoToneMapping;
    this.backend.toneMappingExposure = settings.exposure ?? 1;
  }
  resize(snapshot: ScreenStateSnapshot, resolution: number): void {
    this.snapshot = snapshot;
    this.currentResolution = resolution;
    this.renderer.setPixelRatio(resolution);
    this.renderer.setSize(snapshot.canvas.width, snapshot.canvas.height, false);
    this.canvas.style.width = `${snapshot.viewport.width}px`;
    this.canvas.style.height = `${snapshot.viewport.height}px`;
    this.updateCamera();
  }
  private updateCamera(): void {
    const camera = this.camera;
    if (!camera || !this.snapshot) return;
    const aspect = this.snapshot.viewport.width / this.snapshot.viewport.height;
    ThreeCameraProjection.update(camera, aspect);
  }
  createRoot(): ThreeGroup {
    return new ThreeGroup();
  }
  createProperties(): ThreeProperties {
    return new ThreeProperties();
  }
  createHitTester(getLayout: () => SceneLayout | undefined): ThreeHitTester {
    return new ThreeHitTester(
      getLayout,
      () => {
        if (!this.camera) throw new Error("Active camera is missing");
        return this.camera;
      },
      () => {
        if (!this.snapshot) throw new Error("Screen snapshot is missing");
        return this.snapshot.canvas;
      },
    );
  }
  prepareScene(layout: SceneLayout, cameraPath?: string): void {
    if (!cameraPath) throw new Error("Three scene requires render.camera");
    const view = layout.requireNode(cameraPath, ThreeNode).view;
    if (
      !(view instanceof OrthographicCamera) &&
      !(view instanceof PerspectiveCamera)
    )
      throw new Error("Scene render.camera must name a camera node");
    this.camera = view;
    this.updateCamera();
  }
  renderFrame(): void {
    if (!this.warmup && this.backend && this.camera?.parent)
      this.backend.render(this.scene, this.camera);
  }
  async warmupScene(): Promise<void> {
    const camera = this.camera;
    if (!camera) throw new Error("Three scene warmup requires an active camera");
    const renderer = this.renderer;
    if (renderer.getContext().isContextLost()) throw new Error("Three warmup requires an active WebGL context");
    if (this.warmup) throw new Error("Three warmup is already running");
    const warmup = new RendererWarmup(renderer.domElement, "Three");
    this.warmup = warmup;
    this.warmupStage = "three:compile-shaders";
    try {
      await warmup.wait(() => renderer.compileAsync(this.scene, camera));
      warmup.signal.throwIfAborted();
      // Upload buffers/textures and initialize shadow passes before gameplay starts.
      this.warmupStage = "three:upload-resources";
      if (this.backend === renderer && this.camera === camera) {
        renderer.render(this.scene, camera);
        if (renderer.getContext().isContextLost()) throw new Error("Three WebGL context lost during preparation render");
      }
    } finally {
      warmup.dispose();
      if (this.warmup === warmup) {
        this.warmup = undefined;
        this.warmupStage = undefined;
      }
    }
  }
  getWarmupStage(): string | undefined { return this.warmupStage; }
  tick(_dt: number): void {}
  cleanup(root: import("../../layouts/NodeBase").NodeBase): void {
    if (this.camera && root instanceof ThreeNode && root.view.getObjectById(this.camera.id)) {
      this.warmup?.cancel();
      this.camera = undefined;
    }
  }
  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.warmup?.cancel();
    this.backend?.domElement.remove();
    this.backend?.dispose();
    this.backend?.forceContextLoss();
    this.backend = undefined;
    this.scene.clear();
  }
}
