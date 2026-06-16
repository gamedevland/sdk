/**
 * Scene-level wrapper around a built layout: exposes root container, strict node lookup,
 * per-frame updates and deterministic cleanup.
 *
 * Lifecycle:
 * - Created by internal layout factory from a prebuilt layout result
 * - `update(dt)` is called each frame to update nodes/components
 * - `destroy()` tears down nodes and Pixi container tree
 */
import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { BuiltTreeActivator } from '../build/BuiltTreeActivator';

import type { BuildResult, BuiltElement } from '../build/BuildTypes';
import type { Container } from '../nodes/Container';
import type { NodeBase } from '../nodes/NodeBase';
import type { Sprite } from '../nodes/Sprite';
import type { Text } from '../nodes/Text';
import type { LayoutRuntime } from '@engine/core';
import type * as PIXI from 'pixi.js';

type RuntimeNodeRef = { engine?: LayoutRuntime };

export class SceneLayout {
  private readonly built: BuildResult;
  readonly root: PIXI.Container;
  private readonly engine: LayoutRuntime;
  private readonly elements: Map<string, BuiltElement>;
  private readonly activator = new BuiltTreeActivator();
  private activated = false;
  private destroyNodeId: string | undefined;
  private constructor(engine: LayoutRuntime, built: BuildResult) {
    this.engine = engine;
    this.built = built;
    this.root = built.root;
    this.elements = this.built.elements;
    for (const el of this.elements.values()) {
      const node = el.object as RuntimeNodeRef;
      if (this.hasEngineSlot(node)) node.engine = engine;
    }
  }

  /**
   * Internal creation entrypoint used by SceneLayoutFactory.
   */
  static fromBuildResult(engine: LayoutRuntime, built: BuildResult): SceneLayout {
    return new SceneLayout(engine, built);
  }

  /**
   * Get a node by id (exact element id from the resolved layout) or throw if missing.
   * Prefer using this over optional access to enforce layout integrity at compile/runtime.
   */
  getNode<T extends NodeBase = NodeBase>(id: string): T {
    const el = this.elements.get(id);
    if (!el) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.LayoutMissingRequired,
        subsystem: EngineSubsystem.Layout,
        message: 'Node is not found in scene layout',
        details: { id, method: 'SceneLayout.getNode' },
      });
    }
    return el.object as T;
  }

  /** Typed helpers for common node kinds. */
  getSprite(id: string): Sprite {
    return this.getNode<Sprite>(id);
  }
  getText(id: string): Text {
    return this.getNode<Text>(id);
  }
  getContainer(id: string): Container {
    return this.getNode<Container>(id);
  }

  /** Update all nodes in the layout. */
  update(dt: number): void {
    for (const el of this.elements.values()) (el.object as NodeBase).update(dt);
  }

  /**
   * Activates node components after this layout becomes active in the engine.
   * Safe to call multiple times.
   */
  activate(): void {
    if (this.activated) return;
    const roots: BuiltElement[] = [];
    for (const el of this.elements.values()) {
      if (!el.parentId) roots.push(el);
    }
    for (const root of roots) this.activator.activateTree(root);
    this.activated = true;
    this.emitPostActivationScreenChanged();
  }

  /**
   * Destroy all node objects (without destroying their views) and then dispose
   * the layout root container including Pixi display tree.
   * Safe to call multiple times.
   */
  async destroy(): Promise<void> {
    for (const el of this.elements.values()) {
      const node = el.object as NodeBase;
      if (node && 'destroy' in node) {
        this.destroyNodeId = node.id ?? '[anonymous-node]';
        await node.destroy();
      }
    }
    this.destroyNodeId = undefined;
    // Узлы уже уничтожили свои view; корню достаточно очистить себя без детей
    this.root.destroy({ children: false });
  }

  getLifecycleDebugDetails(): Readonly<Record<string, string>> | undefined {
    if (this.destroyNodeId === undefined) {
      return undefined;
    }
    return {
      layoutDestroyNodeId: this.destroyNodeId,
    };
  }

  /**
   * Re-emit SCREEN_CHANGED after all components are activated so that
   * responsive components whose targets were not yet initialized during
   * post-order activation can recalculate with correct dimensions.
   */
  private emitPostActivationScreenChanged(): void {
    const screen = this.engine.screen;
    this.engine.events.emit({
      type: 'SCREEN_CHANGED',
      data: {
        orientation: screen.getOrientation(),
        viewport: screen.getViewportSize(),
        virtual: screen.getVirtualSize(),
        scale: screen.getScale(),
      },
    });
  }

  private hasEngineSlot(node: RuntimeNodeRef): node is RuntimeNodeRef & { engine?: LayoutRuntime } {
    return typeof node === 'object' && node !== null && 'engine' in node;
  }
}
