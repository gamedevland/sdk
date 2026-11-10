import type { SceneRuntime } from './SceneRuntime';
import type { DiContainerInterface } from '@engine/di/types';
import type { SceneLayout } from '@engine/layouts';

export interface SceneServiceContext {
  readonly sceneKey: string;
  readonly signal?: AbortSignal;
  readonly engine: SceneRuntime;
  readonly layout: SceneLayout;
  readonly sceneDi: DiContainerInterface;
}

export interface SceneServiceTickContext extends SceneServiceContext {
  readonly dt: number;
}

export type SceneServiceTickPhase = 'scene' | 'physics';

export interface SceneService {
  readonly tickPhase?: SceneServiceTickPhase;
  onSceneEnter?(ctx: SceneServiceContext): Promise<void> | void;
  onSceneTick?(ctx: SceneServiceTickContext): void;
  onSceneExit?(ctx: SceneServiceContext): Promise<void> | void;
}

export class SceneServiceTickPhaseResolver {
  private static readonly DefaultPhase: SceneServiceTickPhase = 'scene';

  static resolve(service: SceneService): SceneServiceTickPhase {
    return service.tickPhase ?? SceneServiceTickPhaseResolver.DefaultPhase;
  }
}
