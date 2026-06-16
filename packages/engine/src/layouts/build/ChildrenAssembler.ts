/**
 * Walks element children in layout config and assembles them into the built tree.
 *
 * Responsibilities:
 * - Create child elements using ElementCreator
 * - Add native display objects to the parent's container when present
 * - Register logical children on the parent's domain model (if API is available)
 */
import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { DisplayNode } from '../nodes/types';
import type { ElementConfig } from '../types';
import type { BuiltElement } from './BuildTypes';
import type { ElementCreator } from './ElementCreator';

interface ViewOwner {
  view?: { addChild?: (child: unknown) => void };
}

interface ChildCollectionOwner {
  addChild?: (id: string, node: unknown) => void;
}

export class ChildrenAssembler {
  constructor(private readonly creator: ElementCreator) {}

  /**
   * Build and attach children for a given element id.
   * @param {string} id — Parent element id.
   * @param {ElementConfig} cfg — Parent config containing children map.
   * @param {BuiltElement} parent — Parent built element.
   */
  assemble(id: string, cfg: ElementConfig, parent: BuiltElement): void {
    if (!cfg.children) return; // nothing to assemble
    if (cfg.type !== 'Container') {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Only Container nodes may declare children',
        details: {
          method: 'ChildrenAssembler.assemble',
          nodeId: id,
          nodeType: cfg.type,
        },
      });
    }
    for (const [childKey, childCfg] of Object.entries(cfg.children)) {
      const fullId = `${id}.${childKey}`;
      const child = this.creator.create(fullId, childCfg, parent);
      if (child) {
        parent.children.set(childKey, child);
        const parentView = this.getView(parent.object);
        const childView = this.getView(child.object);
        // Add PIXI view to parent container when both are available
        if (parentView && childView && typeof parentView.addChild === 'function') {
          parentView.addChild(childView);
        }
        // Register the logical child in the node API if supported
        this.addLogicalChild(parent.object, childKey, child.object);
      }
    }
  }

  private getView(
    node: DisplayNode | unknown,
  ): { addChild?: (child: unknown) => void } | undefined {
    if (typeof node !== 'object' || node === null) return undefined;
    return (node as ViewOwner).view;
  }

  private addLogicalChild(parent: unknown, childKey: string, childNode: unknown): void {
    if (typeof parent !== 'object' || parent === null) return;
    (parent as ChildCollectionOwner).addChild?.(childKey, childNode);
  }
}
