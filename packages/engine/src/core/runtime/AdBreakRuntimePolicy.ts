import type { PlatformAdBreakHooks } from '../../platforms';

/**
 * Engine-owned ad-break policy that applies nested runtime pause semantics.
 */
export class AdBreakRuntimePolicy {
  private activeBreakCount = 0;

  constructor(private readonly onBreakPausedChanged: (paused: boolean) => void) {}

  createHooks(): PlatformAdBreakHooks {
    return {
      onAdBreakStart: this.handleAdBreakStart.bind(this),
      onAdBreakEnd: this.handleAdBreakEnd.bind(this),
    };
  }

  private handleAdBreakStart(): void {
    this.activeBreakCount += 1;
    if (this.activeBreakCount === 1) {
      this.onBreakPausedChanged(true);
    }
  }

  private handleAdBreakEnd(): void {
    if (this.activeBreakCount === 0) {
      return;
    }
    this.activeBreakCount -= 1;
    if (this.activeBreakCount === 0) {
      this.onBreakPausedChanged(false);
    }
  }
}
