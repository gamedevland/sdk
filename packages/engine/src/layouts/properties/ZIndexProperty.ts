import type { NodeProperty } from './NodeProperty';

export class ZIndexProperty implements NodeProperty {
  apply(view: unknown, cfg: unknown): void {
    const cfgObj = cfg as { props?: { zIndex?: unknown } } | undefined;
    const d = cfgObj?.props ?? (cfg as { zIndex?: unknown } | undefined);
    if (!view || !d) return;
    if (typeof view !== 'object') return;
    const target = view as {
      zIndex?: number;
      parent?: { sortableChildren?: boolean };
    };
    if (typeof d.zIndex === 'number') {
      target.zIndex = d.zIndex;
      try {
        const p = target.parent;
        if (p && p.sortableChildren !== true) p.sortableChildren = true;
      } catch {
        /* ignore */
      }
    }
  }
}

export default ZIndexProperty;
