import { NodeBase as PixiNode } from '../../layouts/nodes/NodeBase';
import HitTestUtils from './PixiHitTestUtils';

import type { HitTarget } from '../../input/types';
import type { SceneLayout } from '@engine/layouts';
import type { NodeBase } from '@engine/layouts';

export interface HitResult {
  target?: HitTarget;
}

interface DisplayTreeNode {
  children?: DisplayTreeNode[];
  parent?: DisplayTreeNode | null;
  visible?: boolean;
  alpha?: number;
}

/**
 * NodeHitTester resolves which display object (and corresponding layout node) is under a given
 * virtual coordinate.
 *
 * It relies on PIXI-like containers with `children`, `getBounds`, `parent`, and `toLocal` APIs.
 * The search prefers visually top-most children (reverse iteration order) and falls back to bounds
 * hit-testing in the stage's local space.
 *
 * Known limitations:
 * - complex mask/filter clipping is not explicitly evaluated;
 * - occlusion is resolved by visible bounds/hitArea only.
 */
export class NodeHitTester {
  // Tracks interactive nodes/views to prune search space
  private readonly interactiveNodeIds = new Set<string>();
  private readonly interactiveViews = new Set<DisplayTreeNode>();
  private readonly interactiveRefCount = new Map<DisplayTreeNode, number>();
  private readonly idToView = new Map<string, DisplayTreeNode>();
  private readonly viewToId = new WeakMap<object, string>();

  /**
   * @param getActiveLayout Supplier of the currently active SceneLayout (can return undefined)
   */
  constructor(private getActiveLayout: () => SceneLayout | undefined, private readonly getDisplayRoot?: () => PixiNode['view']) {}

  /**
   * Performs hit-testing in virtual coordinates (local to the stage/root container).
   * @returns target information for flat routing mode.
   */
  hitTest(virtual: { x: number; y: number }): HitResult {
    const layout = this.getActiveLayout();
    if (!layout) return {};
    // If there are no interactive nodes registered, skip expensive traversal
    if (this.interactiveNodeIds.size === 0) return {};
    // Ensure id->view mapping and ancestor ref counts are up-to-date
    this.ensureSynced(layout);
    // Recompute reference counts every call for simplicity (flat routing, few interactive nodes)
    this.recomputeRefCounts();
    const root = this.getDisplayRoot?.() ?? layout.root.requireNode(PixiNode).view;
    // Resolve stage/top container each call for clarity
    let top: DisplayTreeNode = root as DisplayTreeNode;
    while (top?.parent) top = top.parent;
    const found = this.findTopMostInteractive(root, virtual, top, true, 1);
    if (!found) return {};
    const id = this.findIdByDisplayObject(found);
    const node = id ? this.resolveRuntimeNode(layout, id) : undefined;
    const target: HitTarget = {
      ...(id ? { id } : {}),
      ...(node ? { node } : {}),
      displayObject: found,
    };
    return { target };
  }

  /**
   * Depth-first search of the render tree to find the visually top-most child whose bounds contain the point.
   * Children are iterated from last to first, assuming the last child is rendered on top.
   * The bounds are checked by projecting world bounds into the stage's local space.
   */
  private findTopMostInteractive(
    container: DisplayTreeNode,
    virtual: { x: number; y: number },
    top: DisplayTreeNode,
    inheritedVisible = true,
    inheritedAlpha = 1,
  ): DisplayTreeNode | null | undefined {
    if (!container || !container.children) return undefined;
    for (let i = container.children.length - 1; i >= 0; i--) {
      const child = container.children[i];
      if (!child) continue;
      // Compute effective visibility/alpha for Pixi v8 (no worldVisible/worldAlpha)
      const childVisible = inheritedVisible && child.visible !== false;
      const childAlpha = inheritedAlpha * (typeof child.alpha === 'number' ? child.alpha : 1);
      if (!childVisible || childAlpha <= 0) continue;
      // Prune: skip branches with no interactive descendants and non-interactive leaf
      const hasInteractiveDescendants = this.getRefCount(child) > 0;
      const isInteractiveLeaf = this.interactiveViews.has(child);
      if (!hasInteractiveDescendants && !isInteractiveLeaf) continue;
      // Search deeper first (top-most rendered child has priority)
      const deep = this.findTopMostInteractive(child, virtual, top, childVisible, childAlpha);
      // When a deeper branch reports occlusion (returns null), stop searching siblings beneath it
      if (deep) return deep;
      if (deep === null) return null;
      // Then check this child itself only if it's an interactive leaf
      if (isInteractiveLeaf) {
        if (HitTestUtils.containsPoint(child, virtual, top)) return child;
      }
      // Only interactive leaf nodes may occlude lower siblings in flat engine input routing.
      if (this.isOccludingChild(child, virtual, top)) return null;
    }
    return undefined;
  }

  private isOccludingChild(
    child: DisplayTreeNode,
    virtual: { x: number; y: number },
    top: DisplayTreeNode,
  ): boolean {
    const isInteractiveLeaf = this.interactiveViews.has(child);
    if (!isInteractiveLeaf) {
      return false;
    }
    return HitTestUtils.containsPoint(child, virtual, top);
  }

  /**
   * Attempts to resolve a layout element id by matching the display object reference.
   * Uses the built element map when available.
   */
  private findIdByDisplayObject(displayObject: unknown): string | undefined {
    let current: unknown = displayObject;
    while (current && typeof current === 'object') {
      const id = this.viewToId.get(current);
      if (id) return id;
      current = (current as DisplayTreeNode).parent;
    }
    return undefined;
  }

  /** Register nodeId/view as interactive. */
  addInteractive(nodeId: string): void {
    if (this.interactiveNodeIds.has(nodeId)) return; // idempotent
    this.interactiveNodeIds.add(nodeId);
    const layout = this.getActiveLayout();
    const view = this.resolveNodeView(layout, nodeId);
    if (view) {
      this.idToView.set(nodeId, view);
      this.interactiveViews.add(view);
      this.viewToId.set(view as object, nodeId);
      return;
    }
  }

  /** Unregister nodeId/view as interactive. */
  removeInteractive(nodeId: string): void {
    this.interactiveNodeIds.delete(nodeId);
    const view = this.idToView.get(nodeId);
    if (view) {
      this.interactiveViews.delete(view);
      this.idToView.delete(nodeId);
    }
  }

  /** Clears all interactive tracking (e.g., when switching scenes). */
  clearInteractive(): void {
    this.interactiveNodeIds.clear();
    this.interactiveViews.clear();
    this.interactiveRefCount.clear();
    this.idToView.clear();
    // WeakMap viewToId will be GC-collected
  }

  private ensureSynced(layout: SceneLayout): void {
    // Ensure mappings only for interactive ids.
    for (const id of this.interactiveNodeIds) {
      const view = this.resolveNodeView(layout, id);
      if (!view) continue;

      const prevView = this.idToView.get(id);
      if (prevView && prevView !== view) {
        this.interactiveViews.delete(prevView);
      }
      if (prevView !== view) {
        this.idToView.set(id, view);
        this.interactiveViews.add(view);
        this.viewToId.set(view as object, id);
      }
    }
  }

  private recomputeRefCounts(): void {
    this.interactiveRefCount.clear();
    for (const view of this.interactiveViews) this.bumpRefChain(view, +1);
  }

  private getRefCount(view: DisplayTreeNode): number {
    return this.interactiveRefCount.get(view) ?? 0;
  }

  private bumpRefChain(view: DisplayTreeNode, delta: number): void {
    let cur: DisplayTreeNode | null | undefined = view;
    while (cur) {
      const prev = this.interactiveRefCount.get(cur) ?? 0;
      const next = Math.max(0, prev + delta);
      if (next === 0) this.interactiveRefCount.delete(cur);
      else this.interactiveRefCount.set(cur, next);
      cur = cur.parent;
    }
  }

  private resolveNodeView(
    layout: SceneLayout | undefined,
    nodeId: string,
  ): DisplayTreeNode | undefined {
    if (!layout) return undefined;
    const node = this.resolveRuntimeNode(layout, nodeId);
    return node instanceof PixiNode ? node.view : undefined;
  }

  private resolveRuntimeNode(layout: SceneLayout, nodeId: string): NodeBase | undefined {
    const direct = layout.findNode(nodeId);
    if (direct) return direct;
    try { return layout.root.getChildNode(nodeId); } catch { return undefined; }
  }
}
