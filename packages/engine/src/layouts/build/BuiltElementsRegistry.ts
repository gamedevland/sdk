import type { BuiltElement } from './BuildTypes';
import type { NodeBase } from '../NodeBase';
import type { ElementConfig } from '../types';
export class BuiltElementsRegistry {
  private readonly elements = new Map<string, BuiltElement>();
  add(id: string, cfg: ElementConfig, object: NodeBase, parentId?: string): BuiltElement {
    if (this.elements.has(id)) throw new Error('Duplicate layout node: ' + id);
    const built: BuiltElement = {id, cfg, object, children: new Map(), ...(parentId ? {parentId} : {})};
    this.elements.set(id, built);
    return built;
  }
  entries(): IterableIterator<BuiltElement> { return this.elements.values(); }
  toMap(): Map<string, BuiltElement> { return this.elements; }
}
