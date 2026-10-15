export type RuntimePauseReason = 'pageInactive' | 'manual' | 'platform' | 'adBreak';

export interface RuntimeActivitySnapshot {
  readonly pageInactive: boolean;
  readonly effectivePaused: boolean;
  readonly reasons: readonly RuntimePauseReason[];
}

/** Observable activity independent of the paused scene ticker. */
export class RuntimeActivity {
  private snapshot: RuntimeActivitySnapshot = Object.freeze({
    pageInactive: false,
    effectivePaused: false,
    reasons: Object.freeze([]),
  });
  private readonly listeners = new Set<(snapshot: RuntimeActivitySnapshot) => void>();

  getSnapshot(): RuntimeActivitySnapshot {
    return this.snapshot;
  }

  subscribe(listener: (snapshot: RuntimeActivitySnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  update(reasons: readonly RuntimePauseReason[]): void {
    if (this.snapshot.reasons.join('|') === reasons.join('|')) return;
    this.snapshot = Object.freeze({
      pageInactive: reasons.includes('pageInactive'),
      effectivePaused: reasons.length > 0,
      reasons: Object.freeze([...reasons]),
    });
    for (const listener of [...this.listeners]) {
      try { listener(this.snapshot); }
      catch (error) { console.error('[RuntimeActivity] Listener failed', error); }
    }
  }
}
