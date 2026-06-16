import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { GameConfig } from './GameConfig';

type EngineLifecycleState = 'created' | 'initialized' | 'mounted' | 'started';

interface EngineLifecycleManagerHooks {
  initializeRenderer(options: { background?: string }): Promise<void>;
  mountRenderer(container: HTMLElement): void;
  startRuntime(config: GameConfig): Promise<void>;
}

export class EngineLifecycleManager {
  private lifecycleState: EngineLifecycleState = 'created';

  constructor(private readonly hooks: EngineLifecycleManagerHooks) {}

  async init(options: { background?: string } = {}): Promise<void> {
    this.assertLifecycleState('created', 'Engine.init');
    await this.hooks.initializeRenderer(options);
    this.lifecycleState = 'initialized';
  }

  mount(container: HTMLElement): void {
    this.assertLifecycleState('initialized', 'Engine.mount');
    this.hooks.mountRenderer(container);
    this.lifecycleState = 'mounted';
  }

  async start(config: GameConfig): Promise<void> {
    this.assertLifecycleState('mounted', 'Engine.start');
    await this.hooks.startRuntime(config);
    this.lifecycleState = 'started';
  }

  private assertLifecycleState(
    expected: 'created' | 'initialized' | 'mounted',
    method: string,
  ): void {
    if (this.lifecycleState === expected) {
      return;
    }
    throw EngineErrorFactory.invariant({
      code: EngineErrorCode.CoreInvariantViolation,
      subsystem: EngineSubsystem.Core,
      message: 'Engine lifecycle state violation',
      details: {
        method,
        expectedLifecycleState: expected,
        actualLifecycleState: this.lifecycleState,
      },
    });
  }
}
