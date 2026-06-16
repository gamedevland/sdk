import type { NodeProperty } from './NodeProperty';

export class AlphaVisibleProperty implements NodeProperty {
  apply(view: unknown, cfg: unknown): void {
    const d = (cfg as { props?: { alpha?: unknown; visible?: unknown } } | undefined)?.props;
    if (!view || !d || typeof view !== 'object') return;
    const target = view as { alpha?: number; visible?: boolean };
    if (typeof d.alpha === 'number') target.alpha = d.alpha;
    if (typeof d.visible === 'boolean') target.visible = d.visible;
  }
}

export default AlphaVisibleProperty;
