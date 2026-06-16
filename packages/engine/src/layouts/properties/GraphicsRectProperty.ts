import { ColorParser } from './internal/ColorParser';

import type { NodeProperty } from './NodeProperty';
import type { NodePropertyContext } from './NodeProperty';

const parser = new ColorParser();

/**
 * Draws rectangle for Graphics-based nodes using width/height/color/radius.
 * Keeps alpha/visibility to other properties in the pipeline.
 */
export class GraphicsRectProperty implements NodeProperty {
  apply(view: unknown, cfg: unknown, ctx: NodePropertyContext): void {
    const cfgObj = cfg as
      | {
          props?: {
            width?: unknown;
            height?: unknown;
            color?: unknown;
            radius?: unknown;
            alpha?: unknown;
          };
        }
      | undefined;
    const d =
      cfgObj?.props ??
      (cfg as
        | { width?: unknown; height?: unknown; color?: unknown; radius?: unknown; alpha?: unknown }
        | undefined);
    if (!view || !d) return;
    if (!(typeof view === 'object' && view !== null && 'clear' in view && 'fill' in view)) return;
    const graphics = view as {
      clear: () => void;
      fill: (style: number | { color: number; alpha?: number }) => unknown;
      rect: (
        x: number,
        y: number,
        w: number,
        h: number,
      ) => {
        fill: (style: number | { color: number; alpha?: number }) => unknown;
      };
      roundRect: (
        x: number,
        y: number,
        w: number,
        h: number,
        r: number,
      ) => { fill: (style: number | { color: number; alpha?: number }) => unknown };
    };

    const w: number | undefined =
      d.width !== undefined
        ? ctx.parse
          ? (ctx.parse(d.width, 'w') ?? (typeof d.width === 'number' ? d.width : undefined))
          : typeof d.width === 'number'
            ? d.width
            : undefined
        : undefined;
    const h: number | undefined =
      d.height !== undefined
        ? ctx.parse
          ? (ctx.parse(d.height, 'h') ?? (typeof d.height === 'number' ? d.height : undefined))
          : typeof d.height === 'number'
            ? d.height
            : undefined
        : undefined;
    if (typeof w !== 'number' || typeof h !== 'number') return;

    const color = parser.parseToNumber(d.color) ?? 0xffffff;
    const radius: number = typeof d.radius === 'number' ? d.radius : 0;
    const alpha = typeof d.alpha === 'number' ? Math.max(0, Math.min(1, d.alpha)) : undefined;
    const fillStyle = alpha === undefined ? color : { color, alpha };

    // rebuild shape
    try {
      graphics.clear();
      if (radius > 0) {
        graphics.roundRect(0, 0, w, h, radius).fill(fillStyle);
      } else {
        graphics.rect(0, 0, w, h).fill(fillStyle);
      }
    } catch {
      /* ignore shape errors to keep pipeline resilient */
    }
  }
}

export default GraphicsRectProperty;
