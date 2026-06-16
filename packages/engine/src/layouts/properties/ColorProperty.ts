import { ColorParser } from './internal/ColorParser';

import type { NodeProperty } from './NodeProperty';

export class ColorProperty implements NodeProperty {
  private readonly parser = new ColorParser();

  apply(view: unknown, cfg: unknown): void {
    const cfgObj = cfg as { props?: { color?: unknown } } | undefined;
    const d = cfgObj?.props ?? (cfg as { color?: unknown } | undefined);
    if (!view || !d) return;
    if (d.color !== undefined && typeof view === 'object' && view !== null && 'tint' in view) {
      const c = this.parser.parseToNumber(d.color);
      if (c !== undefined) (view as { tint?: number }).tint = c;
    }
  }
}

export default ColorProperty;
