import { NodeActions } from './nodes/internal/NodeActions';
import { NodeChildren } from './nodes/internal/NodeChildren';
import { NodeComponents } from './nodes/internal/NodeComponents';
import { NodeInput } from './nodes/internal/NodeInput';
import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '../errors';
import type { BaseAction } from './actions/BaseAction';
import type { BaseComponent } from './components/BaseComponent';
import type { LayoutRuntime } from '../core/ports/LayoutRuntime';

type RuntimeClass<T> = abstract new (...args: never[]) => T;

/** Renderer-neutral ownership of a logical node and its behavior. */
export abstract class NodeBase {
  private _id: string | undefined;
  protected readonly _components = new NodeComponents();
  protected readonly _actions = new NodeActions();
  protected readonly _children = new NodeChildren();
  protected _engine: LayoutRuntime | undefined;
  private readonly _input = new NodeInput(() => this._engine, () => this._id);
  private disposal: Promise<void> | undefined;
  get destroyed(): boolean { return this.disposal !== undefined; }
  readonly acceptsChildren: boolean = false;
  get id(): string | undefined { return this._id; }
  set id(value: string | undefined) { this._id = value; }
  get engine(): LayoutRuntime { return this.getRequiredEngine(); }
  set engine(value: LayoutRuntime | undefined) { this._engine = value; }
  get input(): NodeInput { return this._input; }
  get events() { return this.engine.events; }
  get screen() { return this.engine.screen; }
  getRequiredEngine(): LayoutRuntime {
    if (!this._engine) throw new Error('Node is not attached to an engine: ' + this.id);
    return this._engine;
  }
  getRequiredId(): string {
    if (!this.id) throw new Error('Node ID is missing');
    return this.id;
  }
  getRequiredEvents() { return this.events; }
  abstract attach(child: NodeBase): void;
  abstract detach(): void;
  protected abstract destroyView(): void;
  getChildNode(path: string): NodeBase {
    let node: NodeBase = this;
    for (const part of path.split('.')) {
      if (!part) throw new Error('Invalid child path: ' + path);
      node = node.getChild(part);
    }
    return node;
  }
  requireNode<T extends NodeBase>(type: abstract new (...args: never[]) => T): T {
    if (!(this instanceof type)) throw new Error('Unexpected node type: ' + this.id + ', expected ' + type.name);
    return this;
  }
  update(dt: number): void {
    if (this.destroyed) return;
    this._components.update(dt);
    for (const child of this._children.values()) child.update(dt);
  }
  destroy(): Promise<void> {
    this.disposal ??= this.dispose();
    return this.disposal;
  }
  private async dispose(): Promise<void> {
    const errors: unknown[] = [];
    const operations = [
      () => this._input.destroy(),
      () => this._components.destroy(),
      () => this._actions.destroy(),
      ...Array.from(this._children.values(), child => () => child.destroy()),
      () => this.destroyView(),
    ];
    for (const operation of operations) {
      try { await operation(); } catch (error) { errors.push(error); }
    }
    this._children.clear();
    this._engine = undefined;
    if (errors.length) throw new AggregateError(errors, 'Node disposal failed: ' + this.id);
  }
  /** Register a component on this node. */
  addComponent(id: string, component: BaseComponent, autoEnable = true): void {
    this._components.addComponent(id, component, autoEnable);
  }

  /** Resolve first component by class (deterministic, fail-fast). */
  getComponent<TComponent extends BaseComponent>(expectedType: RuntimeClass<TComponent>): TComponent;
  /** Resolve component by id (fail-fast on missing). */
  getComponent<TComponent extends BaseComponent>(id: string): TComponent;
  getComponent<TComponent extends BaseComponent>(
    first: string | RuntimeClass<TComponent>,
  ): TComponent {
    try {
      if (typeof first === 'string') {
        return this._components.getComponentById(first) as TComponent;
      }
      return this._components.getFirstComponentByType(first);
    } catch (error) {
      const nodeId = this._id ?? '<unknown>';
      const message = error instanceof Error ? error.message : String(error);
      throw EngineErrorFactory.create({
        code: EngineErrorCode.LayoutMissingRequired,
        subsystem: EngineSubsystem.Layout,
        message: 'Failed to resolve component',
        details: { nodeId, method: 'NodeBase.getComponent', reason: message },
        cause: error,
      });
    }
  }

  /** Resolve all components by class in deterministic attachment order. */
  getComponents<TComponent extends BaseComponent>(
    expectedType: RuntimeClass<TComponent>,
  ): readonly TComponent[] {
    return this._components.getComponentsByType(expectedType);
  }

  /** Enable an attached component by id (fail-fast on missing). */
  enableComponent(id: string): void {
    this._components.enableComponent(id);
  }

  /** Disable an attached component by id (fail-fast on missing). */
  disableComponent(id: string): void {
    this._components.disableComponent(id);
  }

  /** Register an action on this node. */
  addAction(id: string, action: BaseAction): void {
    this._actions.addAction(id, action);
  }

  /** Resolve an action by class (deterministic, fail-fast). */
  getAction<TAction extends BaseAction>(expectedType: RuntimeClass<TAction>): TAction {
    try {
      return this._actions.getActionByType(expectedType);
    } catch (error) {
      const nodeId = this._id ?? '<unknown>';
      const message = error instanceof Error ? error.message : String(error);
      throw EngineErrorFactory.create({
        code: EngineErrorCode.LayoutMissingRequired,
        subsystem: EngineSubsystem.Layout,
        message: 'Failed to resolve action',
        details: { nodeId, method: 'NodeBase.getAction', reason: message },
        cause: error,
      });
    }
  }

  /** Run an action by id. */
  runAction(id: string, data?: Record<string, unknown>): Promise<void> {
    return this._actions.runAction(id, data);
  }

  /** Cancel a node action without removing it from the node. */
  cancelAction(id: string): void {
    this._actions.cancelAction(id);
  }

  /** Register a logical child node by local id. */
  addChild(id: string, child: NodeBase): void {
    if (this.destroyed || !this.acceptsChildren) throw new Error('Cannot add a child to this node: ' + this.id);
    this._children.addChild(id, child);
  }

  /** Resolve a direct logical child by local id. */
  getChild(id: string): NodeBase {
    return this._children.getChild(id);
  }

  /** Check if a direct logical child with local id exists. */
  hasChild(id: string): boolean {
    return this._children.hasChild(id);
  }

  /** Remove and return a direct logical child by local id. */
  removeChild(id: string): NodeBase {
    const child = this._children.removeChild(id);
    child.detach();
    return child;
  }

  /** Notify attached components that node tree assembly is completed. */
  notifyComponentsReady(): void {
    this._components.runReadyHooks();
  }

}
