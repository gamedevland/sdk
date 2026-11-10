import type { RuntimeDiagnostics } from '../diagnostics';

/** One engine-owned animation loop; delta is in seconds. */
export class FrameDriver {
  private disposed = false;
  private frame: number | undefined;
  private previous: number | undefined;
  private readonly listeners = new Set<(dt: number) => void>();
  constructor(
    private readonly render: () => void,
    private readonly diagnostics?: RuntimeDiagnostics,
  ) {}
  subscribe(listener: (dt: number) => void): () => void {
    if (this.disposed) throw new Error('Frame driver is disposed');
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  start(): void {
    if (this.disposed) throw new Error('Frame driver is disposed');
    if (this.frame !== undefined) return;
    this.previous = undefined;
    this.frame = requestAnimationFrame(this.tick);
  }
  stop(): void {
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.previous = undefined;
  }
  dispose(): void {
    this.stop();
    this.disposed = true;
    this.listeners.clear();
  }

  private readonly tick = (now: number): void => {
    this.frame = requestAnimationFrame(this.tick);
    const rawDelta = this.previous === undefined ? 1 / 60 : Math.max(0, (now - this.previous) / 1000);
    const dt = Math.min(rawDelta, 0.1);
    if (this.diagnostics?.observed) this.diagnostics.report({ kind: 'frame', rawDelta, simulationDelta: dt });
    this.previous = now;
    for (const listener of [...this.listeners]) {
      if (this.frame === undefined) return;
      listener(dt);
    }
    if (this.frame !== undefined) {
      const start = this.diagnostics?.observed ? performance.now() : undefined;
      try {
        this.render();
      } finally {
        if (start !== undefined)
          this.diagnostics?.report({
            kind: 'timing',
            source: 'render',
            durationMs: performance.now() - start,
          });
      }
    }
  };
}
