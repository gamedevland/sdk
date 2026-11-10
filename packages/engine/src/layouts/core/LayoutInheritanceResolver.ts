import type { LayoutFile, ElementConfig } from '../types';
/** Resolves explicit sibling inheritance before factories run. */
export class LayoutInheritanceResolver {
  resolve(layout: LayoutFile): LayoutFile {
    const result: LayoutFile = {};
    const pending = new Set<string>();
    const resolve = (id: string): ElementConfig => {
      const cached = result[id];
      if (Object.hasOwn(result, id) && cached) return cached;
      const node = layout[id];
      if (!Object.hasOwn(layout, id) || !node) throw new Error('Unknown layout base: ' + id);
      if (pending.has(id)) throw new Error('Cyclic layout inheritance: ' + id);
      pending.add(id);
      const base = node.extends ? resolve(node.extends) : undefined;
      if (base && base.type !== node.type) throw new Error('Layout inheritance cannot change node type: ' + id);
      const merged: ElementConfig = {...base, ...node, props: {...base?.props, ...node.props},
        components: {...base?.components, ...node.components}, actions: {...base?.actions, ...node.actions}};
      const children = {...base?.children, ...node.children};
      if (base?.children || node.children) merged.children = this.resolve(children);
      delete merged.extends;
      Object.defineProperty(result, id, {value: merged, enumerable: true, configurable: true, writable: true});
      pending.delete(id);
      return merged;
    };
    for (const id of Object.keys(layout)) resolve(id);
    return result;
  }
}
