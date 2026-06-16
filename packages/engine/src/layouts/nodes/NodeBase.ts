/**
 * Base class for all layout display nodes.
 *
 * Responsibilities:
 * - Hold the native Pixi view and per-node services (components, actions, input, tweens, styles)
 * - Provide traversal helpers and per-frame update propagation
 * - Handle teardown (components, input, tweens) without altering engine logic
 *
 * Lifecycle:
 * - Created by element factories; `engine` is injected by `SceneLayout`/`Engine` afterwards
 * - `update(dt)` is called from `SceneLayout` once per frame
 * - `destroy()` cleans up listeners, components and child nodes
 */
// NodeBase — базовый класс узла
import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { NodeActions } from './internal/NodeActions';
import { NodeChildren } from './internal/NodeChildren';
import { NodeComponents } from './internal/NodeComponents';
import { NodeInput } from './internal/NodeInput';
import { NodeTweens } from './internal/NodeTweens';

import type { Container } from './Container';
import type { Graphics } from './Graphics';
import type { Sprite } from './Sprite';
import type { Text } from './Text';
import type { TexturedRopeNode } from './types';
import type { BaseAction } from '../actions/BaseAction';
import type { BaseComponent } from '../components/BaseComponent';
import type { LayoutRuntime } from '@engine/core';
import type { IEventBus } from '@engine/events/types';
import type { ScreenManager } from '@engine/screen/ScreenManager';
import type { TimelineBuilder, TweenHandle, TweenOptions } from '@engine/tween/types';
import type * as PIXI from 'pixi.js';

type NodeKind = 'sprite' | 'tilingSprite' | 'texturedRope' | 'container' | 'text' | 'graphics';
type RuntimeClass<T> = abstract new (...args: never[]) => T;

interface TintableView {
  tint: number;
}

export abstract class NodeBase {
  protected _view: PIXI.Container;
  private _id: string | undefined;
  private _components = new NodeComponents();
  private _actions = new NodeActions();
  private _children = new NodeChildren();
  private _tweens = new NodeTweens(
    () => this._engine,
    () => this._view,
  );
  private _input = new NodeInput(
    () => this._engine,
    () => this._id,
  );
  private readonly originalTintByView = new WeakMap<object, number>();
  // events facade (read-only) to avoid components poking engine directly
  get events(): IEventBus {
    return this.getRequiredEngine().events;
  }
  // screen facade (read-only) for components
  get screen(): ScreenManager {
    return this.getRequiredEngine().screen;
  }
  // Доступ к движку будет установлен из SceneLayout/Engine при построении
  protected _engine: LayoutRuntime | undefined;

  constructor(view: PIXI.Container) {
    this._view = view;
  }

  /** Native Pixi view (Container/Sprite/Text/etc.). */
  get view(): PIXI.Container {
    return this._view;
  }
  /** Node id as assigned by the layout builder. */
  get id(): string | undefined {
    return this._id;
  }
  set id(v: string | undefined) {
    this._id = v;
  }
  /** Engine reference injected post-construction. */
  get engine(): LayoutRuntime {
    return this.getRequiredEngine();
  }
  set engine(e: LayoutRuntime | undefined) {
    this._engine = e;
  }

  /** Resolve required engine reference (fail-fast). */
  getRequiredEngine(): LayoutRuntime {
    const engine = this._engine;
    if (!engine) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.LayoutMissingRequired,
        subsystem: EngineSubsystem.Layout,
        message: 'Engine is not attached',
        details: { method: 'NodeBase.getRequiredEngine' },
      });
    }
    return engine;
  }

  /** Resolve required node id (fail-fast). */
  getRequiredId(): string {
    const id = this._id;
    if (!id) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.LayoutMissingRequired,
        subsystem: EngineSubsystem.Layout,
        message: 'Node id is not set',
        details: { method: 'NodeBase.getRequiredId' },
      });
    }
    return id;
  }

  /** Resolve required events facade (fail-fast). */
  getRequiredEvents(): IEventBus {
    const engine = this.getRequiredEngine();
    return engine.events;
  }

  /** Tween helpers bound to this node's view. */
  get tweens(): NodeTweens {
    return this._tweens;
  }
  /** Input helper to subscribe node-scoped handlers. */
  get input(): NodeInput {
    return this._input;
  }

  show(): void {
    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
  }

  setVisible(visible: boolean): this {
    if (typeof visible !== 'boolean') {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Visible flag must be boolean',
        details: { method: 'NodeBase.setVisible', visible },
      });
    }
    this.view.visible = visible;
    return this;
  }

  setAlpha(alpha: number): this {
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Alpha must be a finite number in [0, 1]',
        details: { method: 'NodeBase.setAlpha', alpha },
      });
    }
    this.view.alpha = alpha;
    return this;
  }

  setTint(color: number, amount = 1): this {
    this.assertTintInput(color, amount, 'NodeBase.setTint');
    this.applyTintRecursive(this, color, amount);
    return this;
  }

  clearTint(): this {
    this.clearTintRecursive(this);
    return this;
  }

  setVisualDim(amount: number): this {
    this.assertTintAmount(amount, 'NodeBase.setVisualDim');
    return amount === 0 ? this.clearVisualDim() : this.setTint(0x000000, amount);
  }

  clearVisualDim(): this {
    return this.clearTint();
  }

  setScale(scale: number): this;
  setScale(scale: { x: number; y: number }): this;
  setScale(x: number, y: number): this;
  setScale(
    first: number | { x: number; y: number },
    second?: number,
  ): this {
    let scaleX: number;
    let scaleY: number;
    if (typeof first === 'number') {
      scaleX = first;
      scaleY = second ?? first;
    } else {
      scaleX = first.x;
      scaleY = first.y;
    }
    if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY)) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Scale values must be finite numbers',
        details: { method: 'NodeBase.setScale', scaleX, scaleY },
      });
    }
    this.view.scale.set(scaleX, scaleY);
    return this;
  }

  setX(x: number): this {
    if (!Number.isFinite(x)) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'X must be a finite number',
        details: { method: 'NodeBase.setX', x },
      });
    }
    this.view.x = x;
    return this;
  }

  setY(y: number): this {
    if (!Number.isFinite(y)) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Y must be a finite number',
        details: { method: 'NodeBase.setY', y },
      });
    }
    this.view.y = y;
    return this;
  }

  setPosition(position: { x: number; y: number }): this;
  setPosition(x: number, y: number): this;
  setPosition(
    first: number | { x: number; y: number },
    second?: number,
  ): this {
    let x: number;
    let y: number;
    if (typeof first === 'number') {
      x = first;
      y = second ?? first;
    } else {
      x = first.x;
      y = first.y;
    }
    return this.setX(x).setY(y);
  }

  setAngle(angle: number): this {
    if (!Number.isFinite(angle)) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Angle must be a finite number',
        details: { method: 'NodeBase.setAngle', angle },
      });
    }
    this.view.angle = angle;
    return this;
  }

  setRotation(rotation: number): this {
    if (!Number.isFinite(rotation)) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Rotation must be a finite number',
        details: { method: 'NodeBase.setRotation', rotation },
      });
    }
    this.view.rotation = rotation;
    return this;
  }

  setZIndex(zIndex: number): this {
    if (!Number.isFinite(zIndex)) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'zIndex must be a finite number',
        details: { method: 'NodeBase.setZIndex', zIndex },
      });
    }
    this.view.zIndex = zIndex;
    const parent = this.view.parent;
    if (parent !== null) {
      parent.sortableChildren = true;
    }
    return this;
  }

  setWidth(width: number): this {
    if (!Number.isFinite(width) || width < 0) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Width must be a finite number greater than or equal to 0',
        details: { method: 'NodeBase.setWidth', width },
      });
    }
    this.view.width = width;
    return this;
  }

  setHeight(height: number): this {
    if (!Number.isFinite(height) || height < 0) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Height must be a finite number greater than or equal to 0',
        details: { method: 'NodeBase.setHeight', height },
      });
    }
    this.view.height = height;
    return this;
  }

  setAnchor(anchor: number): this;
  setAnchor(anchor: { x: number; y: number }): this;
  setAnchor(x: number, y: number): this;
  setAnchor(
    first: number | { x: number; y: number },
    second?: number,
  ): this {
    let anchorX: number;
    let anchorY: number;
    if (typeof first === 'number') {
      anchorX = first;
      anchorY = second ?? first;
    } else {
      anchorX = first.x;
      anchorY = first.y;
    }
    if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY)) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Anchor values must be finite numbers',
        details: { method: 'NodeBase.setAnchor', anchorX, anchorY },
      });
    }
    return this.applyAnchor(anchorX, anchorY);
  }

  getGlobalPosition(): { x: number; y: number } {
    const world = this.view.getGlobalPosition();
    return { x: world.x, y: world.y };
  }

  toLocalPosition(position: { x: number; y: number }): { x: number; y: number } {
    const local = this.view.toLocal(position);
    return { x: local.x, y: local.y };
  }

  // Tween шорткаты
  /** Shortcut to engine.tweens.to for this view. */
  tweenTo(props: Record<string, number>, opts?: TweenOptions): TweenHandle | undefined {
    return this._engine?.tweens.to(this, props, opts);
  }
  /** Shortcut to engine.tweens.from for this view. */
  tweenFrom(props: Record<string, number>, opts?: TweenOptions): TweenHandle | undefined {
    return this._engine?.tweens.from(this, props, opts);
  }
  /** Shortcut to engine.tweens.fromTo for this view. */
  tweenFromTo(
    f: Record<string, number>,
    t: Record<string, number>,
    opts?: TweenOptions,
  ): TweenHandle | undefined {
    return this._engine?.tweens.fromTo(this, f, t, opts);
  }
  /** Build a GSAP timeline via engine.tweens.timeline. */
  tweenTimeline(
    setup: (tl: TimelineBuilder) => void,
    opts?: { groupId?: string },
  ): TweenHandle | undefined {
    return this._engine?.tweens.timeline(setup, opts);
  }

  /**
   * Per-frame update entry: updates enabled components and child nodes.
   * @param {number} dt — Delta time in seconds.
   */
  update(dt: number): void {
    this._components.update(dt);
    for (const child of this._children.values()) child.update(dt);
  }

  /**
   * Dispose input, components, actions and children; attempts to kill active tweens.
   * Always destroys the Pixi `view` of this node. Safe to call multiple times.
   */
  async destroy(): Promise<void> {
    // авто-очистка твинов узла, если доступен движок
    try {
      this._engine?.tweens.kill(this);
    } catch {
      /* noop */
    }
    try {
      this._input.destroy();
    } catch {
      /* noop */
    }
    await this._components.destroy();
    for (const child of this._children.values()) await child.destroy();
    try {
      await this._actions.destroy();
    } catch {
      /* noop */
    }
    try {
      // безопасно уничтожаем Pixi view, если ещё не уничтожен
      if (!this._view.destroyed) this._view.destroy({ children: true });
    } catch {
      /* noop */
    }
  }

  /**
   * Find a child node by path (e.g., "a.b.c"). Throws if not found.
   * @param {string} path — Dot-separated child path or local id.
   * @returns {NodeBase} Child node reference.
   */
  getChildNode(path: string): NodeBase {
    // path формата "a.b.c" или локальный id
    const parts = path.split('.');
    const first = parts[0];
    if (!first) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Child path is empty',
        details: { path, method: 'NodeBase.getChildNode' },
      });
    }
    let current: NodeBase = this._children.getChild(first);
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (!part) {
        throw EngineErrorFactory.invalidInput({
          code: EngineErrorCode.LayoutInvalidConfig,
          subsystem: EngineSubsystem.Layout,
          message: 'Invalid child path',
          details: { path, method: 'NodeBase.getChildNode' },
        });
      }
      current = current.getChild(part);
    }
    return current;
  }

  getChildSprite(path: string): Sprite {
    const node = this.getChildNode(path) as NodeBase;
    if (!this.isKind(node, 'sprite')) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Expected Sprite node at path',
        details: { path, method: 'NodeBase.getChildSprite' },
      });
    }
    return node as Sprite;
  }

  getChildContainer(path: string): Container {
    const node = this.getChildNode(path) as NodeBase;
    if (!this.isKind(node, 'container')) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Expected Container node at path',
        details: { path, method: 'NodeBase.getChildContainer' },
      });
    }
    return node as Container;
  }

  getChildText(path: string): Text {
    const node = this.getChildNode(path) as NodeBase;
    if (!this.isKind(node, 'text')) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Expected Text node at path',
        details: { path, method: 'NodeBase.getChildText' },
      });
    }
    return node as Text;
  }

  getChildGraphics(path: string): Graphics {
    const node = this.getChildNode(path) as NodeBase;
    if (!this.isKind(node, 'graphics')) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Expected Graphics node at path',
        details: { path, method: 'NodeBase.getChildGraphics' },
      });
    }
    return node as Graphics;
  }

  getChildRect(path: string): Graphics {
    return this.getChildGraphics(path);
  }

  getChildTexturedRope(path: string): NodeBase & TexturedRopeNode {
    const node = this.getChildNode(path) as NodeBase;
    this.assertTexturedRopeNode(node, 'NodeBase.getChildTexturedRope', path);
    return node;
  }

  asTexturedRope(): TexturedRopeNode {
    this.assertTexturedRopeNode(this, 'NodeBase.asTexturedRope');
    return this;
  }

  private assertTexturedRopeNode(
    node: NodeBase,
    method: string,
    path?: string,
  ): asserts node is NodeBase & TexturedRopeNode {
    if (this.isKind(node, 'texturedRope')) {
      return;
    }
    throw EngineErrorFactory.invalidInput({
      code: EngineErrorCode.LayoutInvalidConfig,
      subsystem: EngineSubsystem.Layout,
      message: path === undefined ? 'Expected TexturedRope node' : 'Expected TexturedRope node at path',
      details: {
        method,
        ...(path === undefined ? {} : { path }),
      },
    });
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
    child.view.parent?.removeChild(child.view);
    return child;
  }

  /** Notify attached components that node tree assembly is completed. */
  notifyComponentsReady(): void {
    this._components.runReadyHooks();
  }

  protected setKind(kind: NodeKind): void {
    (this as NodeBase & { _kind?: NodeKind })._kind = kind;
  }

  protected applyAnchor(anchorX: number, anchorY: number): this {
    throw EngineErrorFactory.invalidInput({
      code: EngineErrorCode.LayoutInvalidConfig,
      subsystem: EngineSubsystem.Layout,
      message: 'Anchor is not supported for this node type',
      details: {
        method: 'NodeBase.setAnchor',
        nodeType: this.constructor.name,
        anchorX,
        anchorY,
      },
    });
  }

  private isKind(node: NodeBase, kind: NodeKind): boolean {
    return (node as NodeBase & { _kind?: NodeKind })._kind === kind;
  }

  private applyTintRecursive(node: NodeBase, color: number, amount: number): void {
    let hasChild = false;
    for (const child of node._children.values()) {
      hasChild = true;
      this.applyTintRecursive(child, color, amount);
    }

    if (hasChild && this.isKind(node, 'container')) {
      return;
    }
    this.applyTintToView(node.view, color, amount);
  }

  private clearTintRecursive(node: NodeBase): void {
    let hasChild = false;
    for (const child of node._children.values()) {
      hasChild = true;
      this.clearTintRecursive(child);
    }

    if (hasChild && this.isKind(node, 'container')) {
      return;
    }
    this.restoreTintForView(node.view);
  }

  private applyTintToView(view: PIXI.Container, color: number, amount: number): void {
    if (!this.isTintableView(view)) {
      return;
    }
    if (!this.originalTintByView.has(view)) {
      this.originalTintByView.set(view, view.tint);
    }
    const originalTint = this.originalTintByView.get(view);
    if (originalTint === undefined) {
      throw EngineErrorFactory.invariant({
        code: EngineErrorCode.LayoutInvariantViolation,
        subsystem: EngineSubsystem.Layout,
        message: 'Original tint was not stored',
        details: { method: 'NodeBase.applyTintToView' },
      });
    }
    view.tint = this.blendTint(originalTint, color, amount);
  }

  private restoreTintForView(view: PIXI.Container): void {
    if (!this.isTintableView(view)) {
      return;
    }
    const originalTint = this.originalTintByView.get(view);
    if (originalTint === undefined) {
      return;
    }
    view.tint = originalTint;
    this.originalTintByView.delete(view);
  }

  private blendTint(from: number, to: number, amount: number): number {
    const fromR = (from >> 16) & 0xff;
    const fromG = (from >> 8) & 0xff;
    const fromB = from & 0xff;
    const toR = (to >> 16) & 0xff;
    const toG = (to >> 8) & 0xff;
    const toB = to & 0xff;
    const r = Math.round(fromR + (toR - fromR) * amount);
    const g = Math.round(fromG + (toG - fromG) * amount);
    const b = Math.round(fromB + (toB - fromB) * amount);
    return (r << 16) + (g << 8) + b;
  }

  private assertTintInput(color: number, amount: number, method: string): void {
    if (!Number.isInteger(color) || color < 0 || color > 0xffffff) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Tint color must be an integer in [0x000000, 0xffffff]',
        details: { method, color },
      });
    }
    this.assertTintAmount(amount, method);
  }

  private assertTintAmount(amount: number, method: string): void {
    if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Tint amount must be a finite number in [0, 1]',
        details: { method, amount },
      });
    }
  }

  private isTintableView(view: PIXI.Container): view is PIXI.Container & TintableView {
    if (!('tint' in view)) {
      return false;
    }
    return typeof view.tint === 'number';
  }
}
