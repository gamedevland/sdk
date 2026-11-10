import type { NodeBase } from '@engine/layouts/NodeBase';
import type { RenderRuntime } from '@engine/rendering/types';
import type { FrameDriver } from '@engine/rendering/FrameDriver';
import type { RuntimeActivity } from '../core/runtime/RuntimeActivity';
import type { AssetManager } from '@engine/assets';
import type { AudioManager } from '@engine/audio';
import type { CommandBus } from '@engine/commands';
import type { EngineDi } from '@engine/di/EngineDi';
import type { DiContainerInterface } from '@engine/di/types';
import type { EventBus } from '@engine/events';
import type { SceneFSM } from '@engine/fsm/SceneFSM';
import type { InputChannel } from '@engine/input/InputChannel';
import type { InputManager } from '@engine/input/InputManager';
import type { SceneLayout } from '@engine/layouts';
import type { PlatformManager } from '@engine/platforms';
import type { PrefabManager } from '@engine/prefabs';
import type SceneManager from '@engine/scenes/SceneManager';
import type { ScreenManager } from '@engine/screen';
import type { GsapTweenManager } from '@engine/tween';

/**
 * Public runtime contract exposed to scenes.
 * Scenes should depend on this contract instead of concrete Engine internals.
 */
export interface SceneRuntime {
  readonly rendering: RenderRuntime;
  readonly frames: FrameDriver;
  readonly activity: RuntimeActivity;
  readonly audio: AudioManager;
  readonly assets: AssetManager;
  readonly scenes: SceneManager;
  readonly commands: CommandBus;
  readonly events: EventBus;
  readonly screen: ScreenManager;
  readonly tweens: GsapTweenManager;
  readonly input: InputManager;
  readonly inputChannel: InputChannel;
  readonly prefabs: PrefabManager;
  readonly platform: PlatformManager;
  readonly di: EngineDi;

  getSceneRenderRoot(): NodeBase;
  getActiveLayout(): SceneLayout | undefined;
  getRequiredActiveLayout(): SceneLayout;
  setActiveLayout(layout: SceneLayout | undefined): void;
  clearActiveLayout(layout: SceneLayout | undefined): void;

  setActiveSceneFSM(fsm: SceneFSM | undefined): void;
  clearActiveSceneFSM(fsm: SceneFSM | undefined): void;
  getCurrentSceneFSM(): SceneFSM | undefined;

  bootstrapConfigBundles(bundleNames: readonly string[]): Promise<void>;

  getActiveSceneDi(): DiContainerInterface | undefined;
  getRequiredActiveSceneDi(): DiContainerInterface;
  setActiveSceneDi(sceneDi: DiContainerInterface | undefined): void;
  clearActiveSceneDi(sceneDi: DiContainerInterface | undefined): void;
}
