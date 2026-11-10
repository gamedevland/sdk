import { DisposalScope } from '../../lifecycle/DisposalScope';
/**
 * Base class for attachable node components with enable/disable lifecycle and per-frame updates.
 *
 * Components encapsulate reusable behavior that can be attached to nodes at build time.
 * They provide lifecycle hooks (attach, enable, disable, detach) and an optional update loop.
 */
import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';
import { SchemaDecoder } from '@engine/validation';

import type { NodeBase } from '@engine/layouts/NodeBase';
import type { TweenHandle } from '@engine/tween/types';
import type { Decoder } from '@engine/validation';

export abstract class BaseComponent<TNode extends NodeBase = NodeBase> {
  protected abstract readonly nodeType: abstract new (...args: never[]) => TNode;
  private _node: TNode | undefined;
  private _enabled = false;
  private _rawConfig: Readonly<Record<string, unknown>> = Object.freeze({});
  private readonly activeTasks = new Set<Promise<void>>();
  private readonly ownedTweens = new Set<TweenHandle>();
  private readonly detachScope = new DisposalScope();

  /** Present after physics/tweens, automatically gated by enabled state and owner lifetime. */
  protected onPresentation(
    callback: (dt: number) => void,
    options: Omit<import('../../runtime/PresentationScheduler').PresentationOptions, 'signal'> = {},
  ): () => void {
    const layout = options.layout ?? this.node.engine.getRequiredActiveLayout();
    return this.ownDisposer(
      this.node.engine.presentation.subscribe(
        (dt) => {
          if (this.enabled && !this.detaching) callback(dt);
        },
        { ...options, layout, signal: this.scopeSignal },
      ),
    );
  }

  /** Own a synchronous cleanup callback until detach; manually releasing is idempotent. */
  protected ownDisposer(dispose: () => void): () => void {
    return this.detachScope.own(dispose);
  }
  protected get scopeSignal(): AbortSignal {
    return this.detachScope.signal;
  }

  private componentScopeVersion = 0;
  private detaching = false;

  /** Access normalized immutable unvalidated component config. */
  protected get rawConfig(): Readonly<Record<string, unknown>> {
    return this._rawConfig;
  }

  protected get isDetaching(): boolean {
    return this.detaching;
  }

  protected getComponentScopeVersion(): number {
    return this.componentScopeVersion;
  }

  protected isComponentScopeVersionCurrent(componentScopeVersion: number): boolean {
    return !this.detaching && this.componentScopeVersion === componentScopeVersion;
  }

  /**
   * Decode component config with a schema decoder.
   */
  protected decodeConfig<T>(decoder: Decoder<T>, sourceName?: string): T {
    const source = sourceName ?? `${this.constructor.name}.config`;
    return SchemaDecoder.decode(this._rawConfig, decoder, source);
  }

  /**
   * Accessor that guarantees a node is attached.
   * Throws if accessed before init or after onDetach.
   */
  protected get node(): TNode {
    if (!this._node) {
      throw EngineErrorFactory.invariant({
        code: EngineErrorCode.LayoutInvariantViolation,
        subsystem: EngineSubsystem.Layout,
        message: 'Component is not attached to a node',
        details: { className: this.constructor.name, method: 'BaseComponent.node' },
      });
    }
    return this._node.requireNode(this.nodeType);
  }

  /**
   * Initialize component with owning node and raw config data.
   * Called once by the engine when component is attached to a node.
   */
  init(node: TNode, data?: Record<string, unknown>): void {
    if (this._node || this.detachScope.disposed)
      throw new Error('Component instances can only be initialized once');
    this.detaching = false;
    node.requireNode(this.nodeType);
    this._node = node;
    this._rawConfig = Object.freeze({ ...(data ?? {}) });
    this.onBaseInit();
  }

  /** Internal template hook for init flow orchestration. */
  protected onBaseInit(): void {
    this.onInit();
  }

  /** Override in subclasses to perform component-specific initialization. */
  protected onInit(): void {}

  /** Override in subclasses to run after the node is attached and children are assembled. */
  protected onReady(): void {}

  /** Engine hook to notify component that the node and its children are ready. */
  ready(): void {
    this.onReady();
  }
  /** Called when component becomes enabled (idempotent). */
  protected onEnable(): void {}
  /** Called when component becomes disabled (idempotent). */
  protected onDisable(): void {}

  get enabled(): boolean {
    return this._enabled;
  }

  /** Enable component if not already enabled. */
  enable(): void {
    if (this._enabled) return;
    this._enabled = true;
    this.onEnable();
  }

  /** Disable component if currently enabled. */
  disable(): void {
    if (!this._enabled) return;
    this._enabled = false;
    this.componentScopeVersion += 1;
    this.killOwnedTweens();
    this.onDisable();
  }

  /** Per-frame update; only called while enabled. */
  update(dt: number): void {
    if (!this._enabled) return;
    this.onUpdate(dt);
  }

  /** Optional update hook for subclasses. */
  protected onUpdate(_dt: number): void {}

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

  protected async continueComponentScope(
    operation: Promise<unknown> | PromiseLike<unknown>,
    componentScopeVersion = this.getComponentScopeVersion(),
  ): Promise<boolean> {
    await operation;
    return this.isComponentScopeVersionCurrent(componentScopeVersion);
  }

  protected async awaitComponentScopeValue<T>(
    operation: Promise<T> | PromiseLike<T>,
    componentScopeVersion = this.getComponentScopeVersion(),
  ): Promise<T | undefined> {
    const result = await operation;
    if (!this.isComponentScopeVersionCurrent(componentScopeVersion)) {
      return undefined;
    }
    return result;
  }

  protected async awaitComponentScopeResource<TResource>(
    operation: Promise<TResource> | PromiseLike<TResource>,
    dispose: (resource: TResource) => Promise<void> | void,
    componentScopeVersion = this.getComponentScopeVersion(),
  ): Promise<TResource | undefined> {
    const resource = await operation;
    if (!this.isComponentScopeVersionCurrent(componentScopeVersion)) {
      await dispose(resource);
      return undefined;
    }
    return resource;
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

  /** Called before component is removed from the node. */
  onDetach(): void | Promise<void> {
    this.componentScopeVersion += 1;
    this.detaching = true;
    const errors: unknown[] = [];
    try {
      this.killOwnedTweens();
    } catch (error) {
      errors.push(error);
    }
    try {
      this.detachScope.dispose();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) throw new AggregateError(errors, 'Behavior detach failed');
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
    this._rawConfig = Object.freeze({});
  }
}
