/** One engine-owned animation loop; delta is in seconds. */
export class FrameDriver {
  private frame: number | undefined;
  private previous: number | undefined;
  private readonly listeners = new Set<(dt: number) => void>();
  constructor(private readonly render: () => void) {}
  subscribe(listener: (dt: number) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  start(): void {
    if (this.frame !== undefined) return;
    this.previous = undefined;
    this.frame = requestAnimationFrame(this.tick);
  }
  stop(): void {
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.previous = undefined;
  }
  private readonly tick = (now: number): void => {
    this.frame = requestAnimationFrame(this.tick);
    const dt = this.previous === undefined ? 1 / 60 : Math.min((now - this.previous) / 1000, 0.1);
    this.previous = now;
    for (const listener of [...this.listeners]) {
      if (this.frame === undefined) return;
      listener(dt);
    }
    if (this.frame !== undefined) this.render();
  };
}
