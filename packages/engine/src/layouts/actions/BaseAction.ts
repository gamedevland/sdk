/**
 * Base class for layout node actions invoked via NodeBase action facade.
 *
 * An action encapsulates a unit of behavior that can be attached to a layout node
 * and executed later, optionally with a payload. Typical examples include playing
 * a tween, emitting an event, or running domain-specific logic. Actions are
 * constructed by the registry and initialized via `init()` before any execution.
 */
import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';
import { SchemaDecoder } from '@engine/validation';

import type { NodeBase } from '../nodes/NodeBase';
import type { TweenHandle } from '@engine/tween/types';
import type { Decoder } from '@engine/validation';

export abstract class BaseAction {
  private _node: NodeBase | undefined;
  private _config: Readonly<Record<string, unknown>> = Object.freeze({});
  private readonly activeTasks = new Set<Promise<void>>();
  private readonly ownedTweens = new Set<TweenHandle>();
  private actionScopeVersion = 0;
  private detaching = false;

  /** Accessor that guarantees an attached node. */
  protected get node(): NodeBase {
    if (!this._node) {
      throw EngineErrorFactory.invariant({
        code: EngineErrorCode.LayoutInvariantViolation,
        subsystem: EngineSubsystem.Layout,
        message: 'Action is not initialized',
        details: { className: this.constructor.name, method: 'BaseAction.node' },
      });
    }
    return this._node;
  }

  /** Read-only normalized raw action config. */
  protected get rawConfig(): Readonly<Record<string, unknown>> {
    return this._config;
  }

  protected get isDetaching(): boolean {
    return this.detaching;
  }

  protected getActionScopeVersion(): number {
    return this.actionScopeVersion;
  }

  protected isActionScopeVersionCurrent(actionScopeVersion: number): boolean {
    return !this.detaching && this.actionScopeVersion === actionScopeVersion;
  }

  /**
   * Decode action config with a schema decoder.
   */
  protected decodeConfig<T>(decoder: Decoder<T>, sourceName?: string): T {
    const source = sourceName ?? `${this.constructor.name}.config`;
    return SchemaDecoder.decode(this.rawConfig, decoder, source);
  }

  /**
   * Decode action input payload with a schema decoder.
   */
  protected decodeInput<T>(
    data: Record<string, unknown> | undefined,
    decoder: Decoder<T>,
    sourceName?: string,
  ): T {
    const source = sourceName ?? `${this.constructor.name}.input`;
    return SchemaDecoder.decode(data, decoder, source);
  }

  /**
   * Initialize action with owning node and raw config data. Called by actions wiring.
   */
  init(node: NodeBase, data?: Record<string, unknown>): void {
    this.detaching = false;
    this._node = node;
    this._config = Object.freeze({ ...(data ?? {}) });
    this.onBaseInit();
  }

  /** Internal template hook for init flow orchestration. */
  protected onBaseInit(): void {
    this.onInit();
  }

  /** Hook for subclasses to perform action-specific initialization. */
  protected onInit(): void {}

  /**
   * Execute action logic with optional payload data.
   *
   * Implementations should be side‑effectful and may be async. If the action
   * performs asynchronous work (like awaiting animations), return a Promise
   * that resolves when work is complete.
   */
  abstract run(data?: Record<string, unknown>): Promise<void> | void;

  invoke(data?: Record<string, unknown>): Promise<void> {
    return this.trackTask(Promise.resolve(this.run(data)));
  }

  protected trackTask<T>(operation: Promise<T> | PromiseLike<T>): Promise<T> {
    const task = Promise.resolve(operation);
    const settledTask = task.then(
      () => undefined,
      () => undefined,
    );
    this.activeTasks.add(settledTask);
    void settledTask.finally(() => {
      this.activeTasks.delete(settledTask);
    });
    return task;
  }

  protected async continueActionScope(
    operation: Promise<unknown> | PromiseLike<unknown>,
    actionScopeVersion = this.getActionScopeVersion(),
  ): Promise<boolean> {
    await operation;
    return this.isActionScopeVersionCurrent(actionScopeVersion);
  }

  protected async awaitActionScopeValue<T>(
    operation: Promise<T> | PromiseLike<T>,
    actionScopeVersion = this.getActionScopeVersion(),
  ): Promise<T | undefined> {
    const result = await operation;
    if (!this.isActionScopeVersionCurrent(actionScopeVersion)) {
      return undefined;
    }
    return result;
  }

  protected ownTween<THandle extends TweenHandle>(handle: THandle): THandle {
    if (this.detaching) {
      handle.kill();
      return handle;
    }
    this.ownedTweens.add(handle);
    void handle.then(
      () => {
        this.ownedTweens.delete(handle);
      },
      () => {
        this.ownedTweens.delete(handle);
      },
    );
    return handle;
  }

  protected killOwnedTweens(): void {
    for (const handle of this.ownedTweens) {
      handle.kill();
    }
    this.ownedTweens.clear();
  }

  /** Cancel active asynchronous work owned by this action without detaching it. */
  cancel(): void {
    this.actionScopeVersion += 1;
    this.killOwnedTweens();
    this.onCancel();
  }

  /** Hook for subclasses to clear action-specific visual state on cancellation. */
  protected onCancel(): void {}

  /**
   * Called before the action is removed from the node.
   */
  onDetach(): void | Promise<void> {
    this.actionScopeVersion += 1;
    this.detaching = true;
    this.killOwnedTweens();
  }

  async completeDetach(): Promise<void> {
    if (this.activeTasks.size > 0) {
      await Promise.allSettled(this.activeTasks);
    }
    this.finalizeDetachState();
  }

  protected finalizeDetachState(): void {
    this.ownedTweens.clear();
    this._node = undefined;
    this._config = Object.freeze({});
  }
}
