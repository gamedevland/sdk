/**
 * Stores child nodes by local id and exposes iteration helpers.
 *
 * Maintains parent-child relationships at the logical (NodeBase) level. The
 * native display hierarchy (Pixi) is managed separately by the building pipeline.
 */
import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { NodeBase } from '@engine/layouts/NodeBase';

export class NodeChildren {
  private readonly map = new Map<string, NodeBase>();

  /** Add or replace a child by id. */
  addChild(id: string, node: NodeBase): void {
    if (!id || this.map.has(id)) throw new Error('Empty or duplicate child ID: ' + id);
    this.map.set(id, node);
  }

  /** Retrieve a child by id or throw if missing. */
  getChild(id: string): NodeBase {
    const n = this.map.get(id);
    if (!n) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.LayoutMissingRequired,
        subsystem: EngineSubsystem.Layout,
        message: 'Child node is not found',
        details: { id, method: 'NodeChildren.getChild' },
      });
    }
    return n;
  }

  /** Check whether a child with the given id exists. */
  hasChild(id: string): boolean {
    return this.map.has(id);
  }

  /** Remove a child by id or throw if missing. */
  removeChild(id: string): NodeBase {
    const child = this.getChild(id);
    this.map.delete(id);
    return child;
  }

  /** Iterate the current children (snapshot iterator). */
  values(): IterableIterator<NodeBase> {
    return this.map.values();
  }
  clear(): void { this.map.clear(); }

}
