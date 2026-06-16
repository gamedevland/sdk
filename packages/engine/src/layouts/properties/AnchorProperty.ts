/**
 * Applies anchor adjustment to views supporting `anchor` or falls back to pivot.
 * For views without `anchor`, pivot is set to width*ax and height*ay when dimensions are known.
 */
import type { NodeProperty } from './NodeProperty';

interface AnchorValue {
  x?: number;
  y?: number;
}

interface AnchorCapable {
  anchor?: {
    set?: (x: number, y: number) => void;
  };
}

export class AnchorProperty implements NodeProperty {
  apply(view: unknown, cfg: unknown): void {
    const cfgObj = cfg as { props?: { anchor?: unknown } } | undefined;
    const d = cfgObj?.props ?? (cfg as { anchor?: unknown } | undefined);
    if (!view) return;
    const hasCfg = d && d.anchor !== undefined;
    let ax: number;
    let ay: number;
    if (hasCfg) {
      if (typeof d.anchor === 'number') {
        ax = d.anchor;
        ay = d.anchor;
      } else {
        const a = d.anchor as AnchorValue;
        ax = typeof a.x === 'number' ? a.x : 0.5;
        ay = typeof a.y === 'number' ? a.y : 0.5;
      }
    } else {
      ax = 0.5;
      ay = 0.5;
    }

    const target = view as AnchorCapable;
    if ('anchor' in target && target.anchor?.set) {
      target.anchor.set(ax, ay);
      return;
    }
  }
}
