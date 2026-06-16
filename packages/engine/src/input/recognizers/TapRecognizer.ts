import type { PointerState } from '../PointerTracker';

/**
 * TapRecognizer determines whether a pointer down/up pair qualifies as a tap
 * based on maximum allowed movement and duration thresholds.
 */
export class TapRecognizer {
  constructor(private cfg: { tapMaxDistance: number; tapMaxDuration: number }) {}

  setConfig(cfg: { tapMaxDistance: number; tapMaxDuration: number }): void {
    this.cfg = cfg;
  }

  /**
   * Checks if the gesture between down and up states is within tap thresholds.
   * - Movement is computed in virtual space using hypot(dx, dy)
   * - Duration is computed from down to the last update time at release
   */
  tryTap(down: PointerState, up: PointerState): boolean {
    const dt = up.lastTime - down.downTime;
    const dx = up.virtualX - down.downX;
    const dy = up.virtualY - down.downY;
    return dt <= this.cfg.tapMaxDuration && Math.hypot(dx, dy) <= this.cfg.tapMaxDistance;
  }
}
