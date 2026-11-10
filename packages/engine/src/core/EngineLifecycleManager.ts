import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { GameConfig } from './GameConfig';

type EngineLifecycleState = 'created' | 'initializing' | 'initialized' | 'mounted' | 'starting' | 'started' | 'disposing' | 'disposed' | 'failed';

interface EngineLifecycleManagerHooks {
  initializeRenderer(options: { background?: string }): Promise<void>;
  mountRenderer(container: HTMLElement): void;
  startRuntime(config: GameConfig): Promise<void>;
}

export class EngineLifecycleManager {
  private lifecycleState: EngineLifecycleState = 'created';
  private pending: Promise<void> | undefined;

  constructor(private readonly hooks: EngineLifecycleManagerHooks) {}

  async init(options: { background?: string } = {}): Promise<void> {
    this.assertLifecycleState('created', 'Engine.init');
    this.lifecycleState = 'initializing';
    await this.runPending(() => this.hooks.initializeRenderer(options), 'initialized');
  }

  mount(container: HTMLElement): void {
    this.assertLifecycleState('initialized', 'Engine.mount');
    this.hooks.mountRenderer(container);
    this.lifecycleState = 'mounted';
  }

  async start(config: GameConfig): Promise<void> {
    this.assertLifecycleState('mounted', 'Engine.start');
    this.lifecycleState = 'starting';
    await this.runPending(() => this.hooks.startRuntime(config), 'started');
  }

  async dispose(): Promise<void> {
    this.lifecycleState = 'disposing';
    await this.pending?.catch(() => undefined);
    this.lifecycleState = 'disposed';
  }

  private async runPending(operation: () => Promise<void>, next: 'initialized' | 'started'): Promise<void> {
    this.pending = Promise.resolve().then(operation);
    try {
      await this.pending;
      if (this.lifecycleState === 'disposing' || this.lifecycleState === 'disposed') {
        throw new Error('Engine was disposed during lifecycle operation');
      }
      this.lifecycleState = next;
    } catch (error) {
      if (this.lifecycleState !== 'disposing' && this.lifecycleState !== 'disposed') this.lifecycleState = 'failed';
      throw error;
    }
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
