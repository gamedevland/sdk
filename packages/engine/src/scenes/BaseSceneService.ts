import type { SceneService, SceneServiceContext } from './SceneService';
import type { DiContainerInterface } from '@engine/di';
import type { SceneLayout } from '@engine/layouts';

export abstract class BaseSceneService implements SceneService {
  private context: SceneServiceContext | undefined;

  onSceneEnter(ctx: SceneServiceContext): Promise<void> | void {
    this.context = ctx;
    return this.onEnter(ctx);
  }

  async onSceneExit(ctx: SceneServiceContext): Promise<void> {
    try {
      await this.onExit(ctx);
    } finally {
      this.context = undefined;
    }
  }

  protected get sceneContext(): SceneServiceContext {
    const context = this.context;
    if (context !== undefined) {
      return context;
    }
    throw new Error(`${this.constructor.name}: scene context is not initialized`);
  }

  protected get sceneLayout(): SceneLayout {
    return this.sceneContext.layout;
  }

  protected get sceneDi(): DiContainerInterface {
    return this.sceneContext.sceneDi;
  }

  protected onEnter(_ctx: SceneServiceContext): Promise<void> | void {}

  protected onExit(_ctx: SceneServiceContext): Promise<void> | void {}
}
