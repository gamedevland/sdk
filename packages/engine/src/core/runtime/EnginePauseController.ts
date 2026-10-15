import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '../../errors';

import { PageActivityMonitor } from './PageActivityMonitor';

import type { RuntimePauseReason } from './RuntimeActivity';

interface EnginePauseControllerOptions {
  onPausedChanged: (paused: boolean) => void;
  onActivityChanged?: (reasons: readonly RuntimePauseReason[]) => void;
}

/**
 * Aggregates runtime pause reasons and emits a single effective pause state.
 */
export class EnginePauseController {
  private readonly pageActivityMonitor: PageActivityMonitor;
  private attached = false;
  private disposed = false;
  private adBreakPaused = false;
  private platformPaused = false;
  private pageInactivePaused = false;
  private manualPaused = false;
  private paused = false;

  constructor(private readonly options: EnginePauseControllerOptions) {
    this.pageActivityMonitor = this.createPageActivityMonitor();
  }

  attach(): void {
    if (this.attached) {
      return;
    }
    this.attached = true;
    this.pageActivityMonitor.attach();
    this.pageInactivePaused = this.pageActivityMonitor.isInactive();
    this.recomputePaused();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.pageActivityMonitor.dispose();
  }

  setManualPaused(paused: boolean): void {
    this.manualPaused = paused;
    this.recomputePaused();
  }

  setAdBreakPaused(paused: boolean): void {
    this.adBreakPaused = paused;
    this.recomputePaused();
  }

  setPlatformPaused(paused: boolean): void {
    this.platformPaused = paused;
    this.recomputePaused();
  }

  isPaused(): boolean {
    return this.paused;
  }

  private createPageActivityMonitor(): PageActivityMonitor {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.CoreMissingRequired,
        subsystem: EngineSubsystem.Core,
        message: 'Browser runtime is required for pause controller',
        details: { method: 'EnginePauseController.createPageActivityMonitor' },
      });
    }
    return new PageActivityMonitor({
      onInactiveChanged: (inactive: boolean) => this.handlePageInactiveChanged(inactive),
    });
  }

  private handlePageInactiveChanged(inactive: boolean): void {
    if (this.disposed) {
      return;
    }
    this.pageInactivePaused = inactive;
    this.recomputePaused();
  }

  private recomputePaused(): void {
    const reasons: RuntimePauseReason[] = [];
    if (this.pageInactivePaused) reasons.push('pageInactive');
    if (this.manualPaused) reasons.push('manual');
    if (this.platformPaused) reasons.push('platform');
    if (this.adBreakPaused) reasons.push('adBreak');
    this.options.onActivityChanged?.(reasons);
    const nextPaused =
      this.pageInactivePaused || this.manualPaused || this.adBreakPaused || this.platformPaused;
    if (nextPaused === this.paused) {
      return;
    }
    this.paused = nextPaused;
    this.options.onPausedChanged(nextPaused);
  }
}
