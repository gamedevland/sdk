export class RuntimeSchedulerProfilingMonitor {
  private static readonly ValidationWindowFrames = 120;
  private static readonly MaxSchedulerCostMs = 2.5;

  private readonly enabled = RuntimeSchedulerProfilingMonitor.detectDevMode();
  private windowFrameCount = 0;
  private windowTotalSchedulerCostMs = 0;
  private windowMaxSchedulerCostMs = 0;

  isEnabled(): boolean {
    return this.enabled;
  }

  onFrameEnd(schedulerDurationMs: number): void {
    this.windowFrameCount += 1;
    this.windowTotalSchedulerCostMs += schedulerDurationMs;
    if (schedulerDurationMs > this.windowMaxSchedulerCostMs) {
      this.windowMaxSchedulerCostMs = schedulerDurationMs;
    }
    if (this.windowFrameCount < RuntimeSchedulerProfilingMonitor.ValidationWindowFrames) {
      return;
    }
    this.validateWindow();
    this.windowFrameCount = 0;
    this.windowTotalSchedulerCostMs = 0;
    this.windowMaxSchedulerCostMs = 0;
  }

  private validateWindow(): void {
    const avgDurationMs = this.windowTotalSchedulerCostMs / this.windowFrameCount;
    if (avgDurationMs <= RuntimeSchedulerProfilingMonitor.MaxSchedulerCostMs) {
      return;
    }
    console.warn('Runtime scheduler overhead exceeded DEV budget', {
      avgDurationMs,
      maxDurationMs: this.windowMaxSchedulerCostMs,
      budgetMs: RuntimeSchedulerProfilingMonitor.MaxSchedulerCostMs,
      windowFrames: this.windowFrameCount,
    });
  }

  private static detectDevMode(): boolean {
    return Boolean(import.meta.env?.DEV);
  }
}
