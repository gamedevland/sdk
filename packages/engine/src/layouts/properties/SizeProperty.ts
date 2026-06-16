/**
 * Applies explicit width/height if provided.
 */
import type { NodeProperty } from './NodeProperty';
import type { NodePropertyContext } from './NodeProperty';

export class SizeProperty implements NodeProperty {
  private parseOr(
    value: unknown,
    parse: ((v: unknown, axis: 'w' | 'h') => number | undefined) | undefined,
    axis: 'w' | 'h',
  ): number | undefined {
    if (typeof value === 'number') return value;
    if (!parse) return undefined;
    return parse(value, axis);
  }

  apply(view: unknown, cfg: unknown, ctx: NodePropertyContext): void {
    const cfgObj = cfg as { props?: { width?: unknown; height?: unknown } } | undefined;
    const d = cfgObj?.props ?? (cfg as { width?: unknown; height?: unknown } | undefined);
    if (!view || !d) return;
    if (typeof view !== 'object') return;
    const target = view as {
      clear?: unknown;
      fill?: unknown;
      width?: number;
      height?: number;
    };
    // Skip PIXI.Graphics: its size is defined by drawn geometry, not by scaling width/height
    if ('clear' in target && 'fill' in target) return;
    const width = this.parseOr(d.width, ctx.parse, 'w');
    const height = this.parseOr(d.height, ctx.parse, 'h');
    if (width !== undefined) target.width = width;
    if (height !== undefined) target.height = height;
  }
}
