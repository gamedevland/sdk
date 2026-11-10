import type { DiContainerInterface } from '../di/types';
import type { AssetManager } from '../assets/AssetManager';
import type { NodeBase } from '../layouts/NodeBase';
import type { BuildContext } from '../layouts/build/BuildTypes';
import type { ElementConfig } from '../layouts/types';
import type { SceneLayout } from '../layouts/scene/SceneLayout';
import type { ScreenConfig, ScreenStateSnapshot } from '../screen/types';
import type { HitTarget } from '../input/types';

export interface HitTester {
  hitTest(point: { x: number; y: number }): { target?: HitTarget };
  addInteractive(id: string): void;
  removeInteractive(id: string): void;
  clearInteractive(): void;
}
export interface LayoutProperties {
  apply(node: NodeBase, config: ElementConfig): void;
}
export interface RenderSurface {
  readonly canvas: HTMLCanvasElement;
  readonly canvases: readonly HTMLCanvasElement[];
  readonly resolution: number;
  resize(snapshot: ScreenStateSnapshot, resolution: number): void;
}
export interface LayoutRenderCapabilities {
  createRoot(): NodeBase;
  createProperties(context: BuildContext, root: NodeBase): LayoutProperties;
}
export interface InputRenderCapabilities {
  createHitTester(getLayout: () => SceneLayout | undefined): HitTester;
}
export interface RenderRuntime extends RenderSurface, LayoutRenderCapabilities, InputRenderCapabilities {
  readonly mode: 'pixi' | 'three' | 'three+pixi';
  readonly root: NodeBase;
  init(background: string): Promise<void>;
  prepareScene(layout: SceneLayout, cameraPath?: string): void;
  /** Prepare GPU resources after component readiness, before scene FSM startup. */
  warmupScene?(): Promise<void>;
  renderFrame(): void;
  tick(dt: number): void;
  cleanup(root: NodeBase): void;
  destroy(): void;
}
export interface RendererModule {
  register(container: DiContainerInterface, assets: AssetManager, config: ScreenConfig): void;
}
