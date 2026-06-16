export interface PointerState {
  id: number;
  type: 'mouse' | 'touch' | 'pen';
  isDown: boolean;
  screenX: number;
  screenY: number;
  virtualX: number;
  virtualY: number;
  downTime: number;
  downX: number;
  downY: number;
  lastTime: number;
}

/**
 * PointerTracker maintains per-pointer state and handles conversion
 * from screen to virtual coordinates via the provided converter.
 */
export class PointerTracker {
  private byId = new Map<number, PointerState>();
  constructor(private toVirtual: (x: number, y: number) => { x: number; y: number }) {}

  /**
   * Retrieves the current state for a pointer id, if present.
   */
  get(id: number): PointerState | undefined {
    return this.byId.get(id);
  }

  /**
   * Registers a pointer press and initializes its state.
   * @param id Pointer identifier from the DOM event
   * @param type Hardware type (mouse, touch, pen)
   * @param x Client X in screen space
   * @param y Client Y in screen space
   * @param time High-resolution timestamp (ms) when the event occurred
   */
  down(id: number, type: PointerState['type'], x: number, y: number, time: number): PointerState {
    const v = this.toVirtual(x, y);
    const st: PointerState = {
      id,
      type,
      isDown: true,
      screenX: x,
      screenY: y,
      virtualX: v.x,
      virtualY: v.y,
      downTime: time,
      downX: v.x,
      downY: v.y,
      lastTime: time,
    };
    this.byId.set(id, st);
    return st;
  }

  /**
   * Updates the pointer's position and time while moving.
   * Returns undefined if the pointer is any.
   */
  move(id: number, x: number, y: number, time: number): PointerState | undefined {
    const st = this.byId.get(id);
    if (!st) return undefined;
    const v = this.toVirtual(x, y);
    st.screenX = x;
    st.screenY = y;
    st.virtualX = v.x;
    st.virtualY = v.y;
    st.lastTime = time;
    return st;
  }

  /**
   * Marks the pointer as released and updates its timestamp.
   * The record is kept to allow post-up computations (e.g., tap tests).
   */
  up(id: number, time: number): PointerState | undefined {
    const st = this.byId.get(id);
    if (!st) return undefined;
    st.isDown = false;
    st.lastTime = time;
    return st;
  }

  /**
   * Removes pointer state from the tracker.
   */
  clear(id: number): void {
    this.byId.delete(id);
  }

  /**
   * Clears all tracked pointer states.
   */
  clearAll(): void {
    this.byId.clear();
  }
}
