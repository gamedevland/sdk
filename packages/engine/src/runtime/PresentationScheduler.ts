import type { SceneLayout } from '../layouts/scene/SceneLayout';

export type PresentationPhase = 'camera' | 'world' | 'ui';
export interface PresentationOptions {
  readonly phase?: PresentationPhase;
  readonly order?: number;
  readonly signal?: AbortSignal;
  readonly layout?: SceneLayout;
}
interface PresentationEntry {
  readonly layout?: SceneLayout;
  readonly callback: (dt: number) => void;
  readonly phase: PresentationPhase;
  readonly order: number;
}
/** Ordered post-physics/post-tween presentation, scoped by explicit owner cancellation. */
export class PresentationScheduler {
  private static readonly phaseOrder = { camera: 0, world: 1, ui: 2 };
  private readonly entries = new Set<PresentationEntry>();
  private readonly releases = new Map<PresentationEntry, () => void>();
  private ordered: readonly PresentationEntry[] = [];
  subscribe(callback: (dt: number) => void, options: PresentationOptions = {}): () => void {
    if (options.signal?.aborted) return () => {};
    if (!Number.isFinite(options.order ?? 0)) throw new Error('Presentation order must be finite');
    const entry = {
      callback,
      phase: options.phase ?? 'world',
      order: options.order ?? 0,
      ...(options.layout ? { layout: options.layout } : {}),
    };
    this.entries.add(entry);
    this.reorder();
    const off = (): void => {
      options.signal?.removeEventListener('abort', off);
      this.releases.delete(entry);
      if (this.entries.delete(entry)) this.reorder();
    };
    this.releases.set(entry, off);
    options.signal?.addEventListener('abort', off, { once: true });
    return off;
  }
  tick(dt: number, activeLayout?: SceneLayout): void {
    for (const entry of this.ordered)
      if (this.entries.has(entry) && (!entry.layout || entry.layout === activeLayout)) entry.callback(dt);
  }
  clear(): void {
    for (const release of [...this.releases.values()]) release();
  }
  private reorder(): void {
    this.ordered = [...this.entries].sort(
      (a, b) =>
        PresentationScheduler.phaseOrder[a.phase] - PresentationScheduler.phaseOrder[b.phase] ||
        a.order - b.order,
    );
  }
}
