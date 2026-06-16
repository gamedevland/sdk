import type { BuiltElement } from './BuildTypes';
import type { DisplayNode } from '../nodes/types';
import type { ElementConfig } from '../types';

/**
 * Tracks built layout elements and owns the lookup index used by SceneLayout.
 */
export class BuiltElementsRegistry {
  private readonly elements = new Map<string, BuiltElement>();

  createProvisional(id: string, cfg: ElementConfig, parentId?: string): BuiltElement {
    const built: BuiltElement = {
      id,
      object: {} as DisplayNode,
      children: new Map(),
      cfg,
      ...(parentId ? { parentId } : {}),
    };
    this.elements.set(id, built);
    return built;
  }

  entries(): IterableIterator<BuiltElement> {
    return this.elements.values();
  }

  toMap(): Map<string, BuiltElement> {
    return this.elements;
  }
}
