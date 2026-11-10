import { HybridRoot } from "./HybridRoot";
import { HybridProperties } from "./HybridProperties";
import { HybridHitTester } from "./HybridHitTester";
import { ThreeNode } from "../three/ThreeNode";
import { NodeBase as PixiNode } from "../../layouts/nodes/NodeBase";
import { ThreeRuntime } from "../three/ThreeRuntime";
import { PixiRuntime } from "../pixi/PixiRuntime";
import { NodeHitTester } from "../pixi/NodeHitTester";
import type { NodeBase } from "../../layouts/NodeBase";
import type { BuildContext } from "../../layouts/build/BuildTypes";
import type { SceneLayout } from "../../layouts/scene/SceneLayout";
import type { LayoutProperties, RenderRuntime } from "../../rendering/types";
import type { ScreenStateSnapshot } from "../../screen/types";

/** Two independent WebGL contexts, one SDK clock, one logical layout and one input router. */
export class HybridRuntime implements RenderRuntime {
  readonly mode = "three+pixi";
  private disposed = false;
  readonly root: HybridRoot;
  constructor(
    private readonly world: ThreeRuntime,
    private readonly ui: PixiRuntime,
  ) {
    this.root = new HybridRoot(world.root, ui.root, false);
  }
  get canvas(): HTMLCanvasElement {
    return this.ui.canvas;
  }
  get canvases(): readonly HTMLCanvasElement[] {
    return [this.world.canvas, this.ui.canvas];
  }
  get resolution(): number {
    return this.world.resolution;
  }
  async init(background: string): Promise<void> {
    if (this.disposed) throw new Error("Hybrid runtime is disposed");
    await this.world.init(background);
    try {
      await this.ui.init(background);
    } catch (error) {
      this.world.destroy();
      throw error;
    }
    for (const [index, canvas] of this.canvases.entries()) {
      canvas.style.position = "absolute";
      canvas.style.inset = "0";
      canvas.style.zIndex = String(index);
      canvas.dataset.engineLayer = index === 0 ? "world" : "ui";
    }
    this.world.canvas.style.pointerEvents = "none";
  }
  resize(snapshot: ScreenStateSnapshot, resolution: number): void {
    this.world.resize(snapshot, resolution);
    this.ui.resize(snapshot, resolution);
  }
  createRoot(): HybridRoot {
    return new HybridRoot(this.world.createRoot(), this.ui.createRoot());
  }
  createProperties(context: BuildContext, root: NodeBase): LayoutProperties {
    if (root instanceof ThreeNode) return this.world.createProperties();
    if (root instanceof PixiNode) return this.ui.createProperties(context, root);
    const hybrid = root.requireNode(HybridRoot);
    return new HybridProperties(
      this.world.createProperties(),
      this.ui.createProperties(context, hybrid.ui),
    );
  }
  createHitTester(getLayout: () => SceneLayout | undefined): HybridHitTester {
    return new HybridHitTester(
      new NodeHitTester(getLayout, () => this.ui.root.view),
      this.world.createHitTester(getLayout),
    );
  }
  prepareScene(layout: SceneLayout, cameraPath?: string): void {
    this.world.prepareScene(layout, cameraPath);
    this.ui.prepareScene(layout);
  }
  async warmupScene(): Promise<void> {
    await Promise.all([this.world.warmupScene(), this.ui.warmupScene()]);
  }
  getWarmupStage(): string | undefined {
    const stages = [this.world.getWarmupStage(), this.ui.getWarmupStage()].filter(Boolean);
    return stages.length > 0 ? stages.join(",") : undefined;
  }
  renderFrame(): void {
    this.world.renderFrame();
    this.ui.renderFrame();
  }
  tick(dt: number): void {
    this.world.tick(dt);
    this.ui.tick(dt);
  }
  cleanup(root: NodeBase): void {
    const hybrid = root.requireNode(HybridRoot);
    this.world.cleanup(hybrid.world);
    this.ui.cleanup(hybrid.ui);
  }
  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    const errors: unknown[] = [];
    for (const runtime of [this.ui, this.world]) {
      try { runtime.destroy(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "Hybrid renderer disposal failed");
  }
}
