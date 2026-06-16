/**
 * Applies uniform or per-axis scale to the view.
 */
import type { NodeProperty } from './NodeProperty';

interface ScaleCapable {
  scale?: {
    x?: number;
    y?: number;
    set?: (x: number, y?: number) => void;
  };
}

export class ScaleProperty implements NodeProperty {
  apply(view: unknown, cfg: unknown): void {
    const cfgObj = cfg as { props?: { scale?: unknown } } | undefined;
    const d = cfgObj?.props ?? (cfg as { scale?: unknown } | undefined);
    if (!view || !d) return;
    const target = view as ScaleCapable;
    if (d.scale !== undefined) {
      if (typeof d.scale === 'number') target.scale?.set?.(d.scale);
      else if (typeof d.scale === 'object') {
        const scaleObj = d.scale as { x?: unknown; y?: unknown };
        const sx = typeof scaleObj.x === 'number' ? scaleObj.x : (target.scale?.x ?? 1);
        const sy = typeof scaleObj.y === 'number' ? scaleObj.y : (target.scale?.y ?? 1);
        target.scale?.set?.(sx, sy);
      }
    }
  }
}
