import type { NodeBase } from '@engine/layouts/NodeBase';
import type { GameConfig } from '../GameConfig';
import type { AssetManager } from '@engine/assets';
import type { CommandBus } from '@engine/commands/CommandBus';
import type { EngineDi } from '@engine/di/EngineDi';
import type { DiContainerInterface, Provider, Token } from '@engine/di/types';
import type { SceneFSM } from '@engine/fsm/SceneFSM';
import type { SceneLayout } from '@engine/layouts';
import type { RuntimeScheduler } from '@engine/runtime/RuntimeScheduler';
import type SceneManager from '@engine/scenes/SceneManager';
import type { Scene } from '@engine/scenes/SceneManager';
import type { SceneRuntime } from '@engine/scenes/SceneRuntime';
import type { SceneService } from '@engine/scenes/SceneService';
import type { ScreenManager } from '@engine/screen';

export interface SceneManagerRuntime extends SceneRuntime {
  readonly assets: AssetManager;
  readonly commands: CommandBus;
  readonly di: EngineDi;
  readonly scenes: SceneManager;
  readonly screen: ScreenManager;
  readonly runtimeScheduler: RuntimeScheduler<Scene>;
  readonly config: { layouts?: GameConfig['layouts'] };

  bootstrapConfigBundles(bundleNames: readonly string[]): Promise<void>;
  bootstrapSceneConfigs(sceneKey: string): Promise<void>;
  createSceneByKey(sceneKey: string): Scene;
  getSceneRenderRoot(): NodeBase;
  setActiveLayout(layout: SceneLayout | undefined): void;
  clearActiveLayout(layout: SceneLayout | undefined): void;
  setActiveSceneFSM(fsm: SceneFSM | undefined): void;
  clearActiveSceneFSM(fsm: SceneFSM | undefined): void;
  setActiveSceneDi(sceneDi: DiContainerInterface | undefined): void;
  clearActiveSceneDi(sceneDi: DiContainerInterface | undefined): void;
  getSceneScopedProviders(sceneKey: string): readonly Provider[];
  getSceneScopedServiceTokens(sceneKey: string): readonly Token<SceneService>[];
}
