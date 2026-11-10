import type { RuntimeDiagnostic, RuntimeDiagnosticObserver } from './types';
/** Observes errors and CPU timings without retaining samples or allowing observer failures into runtime. */
export class RuntimeDiagnostics {
  private readonly observers = new Set<RuntimeDiagnosticObserver>();
  get observed(): boolean {
    return this.observers.size > 0;
  }
  subscribe(observer: RuntimeDiagnosticObserver): () => void {
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }
  report(record: RuntimeDiagnostic): void {
    for (const observer of [...this.observers]) {
      try {
        observer(record);
      } catch {
        /* Diagnostics must not affect runtime execution. */
      }
    }
    if (record.kind === 'error') console.error(record.source, record.error);
  }
  clear(): void {
    this.observers.clear();
  }
}
