/** Owns a backend warmup and rejects pending work on context loss or scene cleanup. */
export class RendererWarmup {
  private readonly controller = new AbortController();
  private readonly onContextLost = (): void => {
    this.controller.abort(new Error(`${this.backend} warmup failed: WebGL context lost`));
  };

  constructor(private readonly canvas: HTMLCanvasElement, private readonly backend: string) {
    canvas.addEventListener('webglcontextlost', this.onContextLost);
  }

  get signal(): AbortSignal { return this.controller.signal; }

  async wait<T>(work: () => Promise<T>): Promise<T> {
    this.signal.throwIfAborted();
    let onAbort = (): void => {};
    const aborted = new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(this.signal.reason);
      this.signal.addEventListener('abort', onAbort, { once: true });
    });
    try {
      return await Promise.race([work(), aborted]);
    } finally {
      this.signal.removeEventListener('abort', onAbort);
    }
  }

  cancel(): void {
    this.controller.abort(new Error(`${this.backend} warmup cancelled`));
    this.dispose();
  }

  dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
  }
}
