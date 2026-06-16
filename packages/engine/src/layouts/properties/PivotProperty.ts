/**
 * Applies pivot coordinates when provided; leaves existing values if axis is omitted.
 */
import type { NodeProperty } from './NodeProperty';

interface PivotCapable {
  pivot?: {
    x?: number;
    y?: number;
    set?: (x: number, y: number) => void;
  };
}

export class PivotProperty implements NodeProperty {
  apply(view: unknown, cfg: unknown): void {
    const cfgObj = cfg as { props?: { pivot?: { x?: unknown; y?: unknown } } } | undefined;
    const d = cfgObj?.props ?? (cfg as { pivot?: { x?: unknown; y?: unknown } } | undefined);
    if (!view || !d?.pivot) return;
    const x = typeof d.pivot.x === 'number' ? d.pivot.x : undefined;
    const y = typeof d.pivot.y === 'number' ? d.pivot.y : undefined;
    const target = view as PivotCapable;
    if (x !== undefined || y !== undefined) {
      const px = x ?? target.pivot?.x ?? 0;
      const py = y ?? target.pivot?.y ?? 0;
      target.pivot?.set?.(px, py);
    }
  }
}
