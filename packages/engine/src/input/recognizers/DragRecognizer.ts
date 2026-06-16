import type { PointerState } from '../PointerTracker';

export type DragPhase = 'idle' | 'started';

/**
 * DragRecognizer is a minimal state machine recognizing drag gestures.
 * It tracks which pointer initiated the drag and exposes helpers to query/advance state.
 */
export class DragRecognizer {
  private phase: DragPhase = 'idle';
  private captorId: number | undefined;

  constructor(private cfg: { dragStartDistance: number }) {}

  setConfig(cfg: { dragStartDistance: number }): void {
    this.cfg = cfg;
  }

  /**
   * Returns true if the pointer moved far enough from the press point to start dragging.
   */
  shouldStart(st: PointerState): boolean {
    const dx = st.virtualX - st.downX;
    const dy = st.virtualY - st.downY;
    return Math.hypot(dx, dy) >= this.cfg.dragStartDistance;
  }

  /**
   * Transitions to `started` and records the pointer id as the drag captor.
   */
  start(id: number): void {
    this.phase = 'started';
    this.captorId = id;
  }

  /**
   * Checks whether any pointer currently owns the active drag gesture.
   */
  hasActiveDrag(): boolean {
    return this.phase === 'started';
  }

  /**
   * Checks whether a given pointer id is currently dragging.
   */
  isDragging(id: number): boolean {
    return this.phase === 'started' && this.captorId === id;
  }
  /**
   * Resets to `idle` and clears the captor id.
   */
  end(): void {
    this.phase = 'idle';
    this.captorId = undefined;
  }
}
