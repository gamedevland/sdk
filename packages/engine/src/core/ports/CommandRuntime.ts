import type { AssetManager } from '@engine/assets';
import type { EngineDi } from '@engine/di/EngineDi';
import type { DiContainerInterface } from '@engine/di/types';
import type { SceneLayout } from '@engine/layouts';

export interface CommandRuntime {
  readonly di: EngineDi;
  readonly assets: AssetManager;

  getRequiredActiveLayout(): SceneLayout;
  getRequiredActiveSceneDi(): DiContainerInterface;
  getRequiredActiveSceneParams(): Readonly<Record<string, unknown>>;
}
