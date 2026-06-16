import type { NodeProperty } from './NodeProperty';

export class AngleProperty implements NodeProperty {
  apply(view: unknown, cfg: unknown): void {
    const cfgObj = cfg as { props?: { angle?: unknown; rotation?: unknown } } | undefined;
    const d = cfgObj?.props ?? (cfg as { angle?: unknown; rotation?: unknown } | undefined);
    if (!view || !d || typeof view !== 'object') return;
    const target = view as { angle?: number; rotation?: number };
    if (typeof d.angle === 'number') target.angle = d.angle;
    if (typeof d.rotation === 'number') target.rotation = d.rotation;
  }
}

export default AngleProperty;
