import type { BuiltElement } from './BuildTypes';
import type { NodeBase } from '../nodes/NodeBase';

/**
 * Activates built node trees by notifying components in post-order:
 * children first, then parent.
 */
export class BuiltTreeActivator {
  activateTree(root: BuiltElement): void {
    for (const child of root.children.values()) this.activateTree(child);
    (root.object as NodeBase).notifyComponentsReady();
  }
}
