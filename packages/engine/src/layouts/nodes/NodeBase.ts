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
import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { NodeBase as LayoutNode } from '../NodeBase';
import { NodeTweens } from './internal/NodeTweens';

import type { Container } from './Container';
import type { Graphics } from './Graphics';
import type { Sprite } from './Sprite';
import type { Text } from './Text';
import type { TexturedRopeNode } from './types';
import type { TimelineBuilder, TweenHandle, TweenOptions } from '@engine/tween/types';
import type * as PIXI from 'pixi.js';

type NodeKind = 'sprite' | 'nineSliceSprite' | 'tilingSprite' | 'texturedRope' | 'container' | 'text' | 'graphics';

interface TintableView {
  tint: number;
}

export abstract class NodeBase extends LayoutNode {
  protected _view: PIXI.Container;
  private _tweens = new NodeTweens(
    () => this._engine,
    () => this._view,
  );
  private readonly originalTintByView = new WeakMap<object, number>();
  constructor(view: PIXI.Container) {
    super();
    this._view = view;
  }

  /** Native Pixi view (Container/Sprite/Text/etc.). */
  get view(): PIXI.Container {
    return this._view;
  }
  /** Tween helpers bound to this node's view. */
  get tweens(): NodeTweens {
    return this._tweens;
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

  /**
   * Read the node's untransformed bounds in its own local coordinate space.
   *
   * Use this for layout and prefab geometry queries without reaching into the
   * renderer-specific native view.
   */
  getLocalBounds(): {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  } {
    const bounds = this.view.getLocalBounds();
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
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

  // Node-owned tween shortcuts
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

  override getChildNode(path: string): NodeBase {
    return super.getChildNode(path).requireNode(NodeBase);
  }
  attach(child: LayoutNode): void {
    this.view.addChild(child.requireNode(NodeBase).view);
  }
  detach(): void { this.view.removeFromParent(); }
  protected destroyView(): void {
    this._engine?.tweens.kill(this);
    if (!this.view.destroyed) this.view.destroy({ children: true });
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
      this.applyTintRecursive(child.requireNode(NodeBase), color, amount);
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
      this.clearTintRecursive(child.requireNode(NodeBase));
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
