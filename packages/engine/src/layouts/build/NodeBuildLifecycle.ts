import type { DisplayNode } from '../nodes/types';
import type { LayoutRuntime } from '@engine/core';

interface EngineSlot {
  engine?: unknown;
}

/**
 * Applies post-creation runtime hooks for built nodes.
 */
export class NodeBuildLifecycle {
  bindEngine(node: DisplayNode, engine: LayoutRuntime | undefined): void {
    if (!engine) return;
    if (this.hasEngineSlot(node)) {
      node.engine = engine;
    }
  }

  private hasEngineSlot(node: unknown): node is DisplayNode & EngineSlot {
    return typeof node === 'object' && node !== null && 'engine' in node;
  }
}
