import type { InputHandler } from './types';

/**
 * ListenerRegistry keeps track of original handlers and their bound variants
 * per `thisArg`, enabling consistent unbinding later.
 */
export class ListenerRegistry {
  private map = new Map<InputHandler, Map<unknown, InputHandler>>();

  /**
   * Returns a handler bound to `thisArg` (or the original if no thisArg),
   * recording the association for future lookups.
   */
  bind(handler: InputHandler, thisArg?: unknown): InputHandler {
    const bound =
      thisArg !== undefined ? (handler.bind(thisArg as object) as InputHandler) : handler;
    let byThis = this.map.get(handler);
    if (!byThis) {
      byThis = new Map();
      this.map.set(handler, byThis);
    }
    byThis.set(thisArg, bound);
    return bound;
  }

  /**
   * Returns the previously stored bound handler for a given (handler, thisArg) pair without modifying state.
   */
  peek(handler: InputHandler, thisArg?: unknown): InputHandler | undefined {
    return this.map.get(handler)?.get(thisArg);
  }

  /**
   * Removes the stored association for (handler, thisArg). If no bound handlers remain for `handler`,
   * the handler entry itself is removed.
   */
  unbind(handler: InputHandler, thisArg?: unknown): void {
    const byThis = this.map.get(handler);
    if (!byThis) return;
    byThis.delete(thisArg);
    if (byThis.size === 0) this.map.delete(handler);
  }
}
