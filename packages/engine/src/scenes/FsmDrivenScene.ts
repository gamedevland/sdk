import { BaseScene } from './BaseScene';

import type { SceneContext } from './SceneManager';
import type { SceneConfig } from '@engine/core';
import type { SceneEvent } from '@engine/fsm';

export class FsmDrivenSceneLifecycleEvents {
  static readonly SceneReady = 'SCENE_READY';
  static readonly SceneTick = 'SCENE_TICK';
}

/**
 * Base scene that bridges scene lifecycle into the scene FSM.
 *
 * @remarks
 * Use this scene when a game scene is orchestrated through the standard
 * `FSM -> Command -> Service` flow and should remain free from manual lifecycle wiring.
 */
export abstract class FsmDrivenScene extends BaseScene {
  constructor(config: SceneConfig) {
    super(config);
  }

  protected override async create(): Promise<void> {
    await this.dispatchToFSM({ type: FsmDrivenSceneLifecycleEvents.SceneReady });
  }

  protected override afterSceneServicesTick(dt: number): void {
    void this.dispatchToFSM({ type: FsmDrivenSceneLifecycleEvents.SceneTick, payload: { dt } });
  }

  override async onExit(ctx: SceneContext): Promise<void> {
    await super.onExit(ctx);
  }

  private async dispatchToFSM(event: SceneEvent): Promise<void> {
    const fsm = this.getFSM();
    if (!fsm) {
      throw new Error('FsmDrivenScene.dispatchToFSM: FSM is not initialized');
    }
    await fsm.dispatch(event);
  }
}
