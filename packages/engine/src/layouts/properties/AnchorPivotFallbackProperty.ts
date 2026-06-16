/**
 * Computes pivot from anchor for views without native `anchor` support.
 *
 * Applied only when:
 * - view supports `pivot` but not `anchor`
 * - layout config explicitly specifies `anchor`
 * - layout config does NOT explicitly specify `pivot`
 *
 * Uses LOCAL bounds to avoid scale-transformed sizes.
 */
import type { NodeProperty } from './NodeProperty';

interface AnchorValue {
  x?: number;
  y?: number;
}

interface PivotLike {
  set?: (x: number, y: number) => void;
}

interface BoundsLike {
  width?: number;
  height?: number;
}

interface AnchorPivotView {
  anchor?: unknown;
  pivot?: PivotLike;
  scale?: { x?: number; y?: number };
  width?: number;
  height?: number;
  getLocalBounds?: () => BoundsLike;
}

interface AnchorPivotConfig {
  props?: AnchorPivotConfig;
  anchor?: number | AnchorValue;
  pivot?: { x?: number; y?: number };
}

export class AnchorPivotFallbackProperty implements NodeProperty {
  apply(view: unknown, cfg: unknown): void {
    const typedView = (view ?? undefined) as AnchorPivotView | undefined;
    const typedCfg = (cfg ?? undefined) as AnchorPivotConfig | undefined;
    const d = typedCfg?.props ?? typedCfg;
    if (!typedView || !d) return;
    // must have anchor specified in config
    if (d.anchor === undefined) return;
    // must not have explicit pivot in config
    if (d.pivot && (typeof d.pivot.x === 'number' || typeof d.pivot.y === 'number')) return;
    // only for views without native anchor but with pivot support
    if ('anchor' in typedView) return;
    if (!('pivot' in typedView) || !typedView.pivot?.set) return;

    let ax: number;
    let ay: number;
    if (typeof d.anchor === 'number') {
      ax = d.anchor;
      ay = d.anchor;
    } else {
      const a = d.anchor;
      ax = typeof a.x === 'number' ? a.x : 0.5;
      ay = typeof a.y === 'number' ? a.y : 0.5;
    }

    try {
      const b = typedView.getLocalBounds?.();
      const localW =
        typeof b?.width === 'number'
          ? b.width
          : typeof typedView.width === 'number' &&
              typeof typedView.scale?.x === 'number' &&
              typedView.scale.x !== 0
            ? typedView.width / typedView.scale.x
            : undefined;
      const localH =
        typeof b?.height === 'number'
          ? b.height
          : typeof typedView.height === 'number' &&
              typeof typedView.scale?.y === 'number' &&
              typedView.scale.y !== 0
            ? typedView.height / typedView.scale.y
            : undefined;
      if (typeof localW === 'number' && typeof localH === 'number') {
        typedView.pivot.set(localW * ax, localH * ay);
      }
    } catch {
      /* keep pipeline resilient */
    }
  }
}

export default AnchorPivotFallbackProperty;
