import { BuiltTreeActivator } from '../build/BuiltTreeActivator';
import type { NodeBase } from '../NodeBase';
import type { BuildResult, BuiltElement } from '../build/BuildTypes';
import type { LayoutRuntime } from '../../core/ports/LayoutRuntime';

/** Owns the built node tree; the ID index is never used as an update traversal. */
export class SceneLayout {
  readonly root: NodeBase;
  private readonly elements: Map<string, BuiltElement>;
  private activated = false;
  private destroying = false;
  private constructor(private readonly engine: LayoutRuntime, built: BuildResult) {
    this.root = built.root;
    this.elements = built.elements;
    for (const element of this.elements.values()) element.object.engine = engine;
  }
  static fromBuildResult(engine: LayoutRuntime, built: BuildResult): SceneLayout {
    return new SceneLayout(engine, built);
  }
  getNode(id: string): NodeBase {
    const node = this.findNode(id);
    if (!node) throw new Error('Node is not found in scene layout: ' + id);
    return node;
  }
  findNode(id: string): NodeBase | undefined {
    const indexed = this.elements.get(id)?.object;
    if (indexed && !indexed.destroyed) return indexed;
    let node: NodeBase = this.root;
    for (const part of id.split('.')) {
      if (!node.hasChild(part)) return undefined;
      node = node.getChild(part);
    }
    return node.destroyed ? undefined : node;
  }
  requireNode<T extends NodeBase>(id: string, type: abstract new (...args: never[]) => T): T {
    return this.getNode(id).requireNode(type);
  }
  update(dt: number): void { this.root.update(dt); }
  activate(): void {
    if (this.root.destroyed) throw new Error('Cannot activate a disposed layout');
    if (this.activated) return;
    const activator = new BuiltTreeActivator();
    for (const element of this.elements.values()) if (!element.parentId) activator.activateTree(element);
    this.activated = true;
    const screen = this.engine.screen;
    this.engine.events.emit({type: 'SCREEN_CHANGED', data: {
      orientation: screen.getOrientation(), viewport: screen.getViewportSize(),
      virtual: screen.getVirtualSize(), scale: screen.getScale(),
    }});
  }
  async destroy(): Promise<void> {
    this.destroying = true;
    try { await this.root.destroy(); } finally { this.elements.clear(); this.destroying = false; }
  }
  getLifecycleDebugDetails(): Readonly<Record<string, string>> | undefined {
    return this.destroying ? {layoutDestroyNodeId: this.root.id ?? '<layout-root>'} : undefined;
  }
}
