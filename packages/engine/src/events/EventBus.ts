import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { AppEvent, EventBusEmitInput, EventHandler, IEventBus } from './types';

/**
 * EventBus is a lightweight publish/subscribe implementation used by the engine.
 *
 * Key properties:
 * - Handlers are stored per `type` and in a catch‑all set for `onAny`.
 * - Emitting is fail‑safe: exceptions and rejections in handlers are reported so emitters are not impacted.
 * - Subscriptions return an unsubscribe function for easy cleanup.
 */
export class EventBus implements IEventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private anyHandlers: Set<EventHandler> = new Set();

  constructor(private readonly onError: (error: unknown, event: AppEvent) => void =
    (error, event) => console.error('Event handler failed: ' + event.type, error)) {}

  private invoke(handler: EventHandler, event: AppEvent): void {
    try {
      const result = handler(event);
      if (result) void Promise.resolve(result).catch(error => this.reportError(error, event));
    } catch (error) {
      this.reportError(error, event);
    }
  }

  private reportError(error: unknown, event: AppEvent): void {
    try { this.onError(error, event); } catch { /* Error observers cannot break event delivery. */ }
  }

  /**
   * Emit an event to all listeners subscribed to its `type` and to any `onAny` listeners.
   *
   * Accepts `{ type, data, meta }` and converts it into an `AppEvent` by mapping
   * `data` to `payload`.
   *
   * Complex logic: The method clones handler sets via spread `[...set]` before
   * iteration. This prevents issues if handlers unsubscribe themselves while
   * iterating (mutating a set during iteration can skip or duplicate callbacks).
   */
  emit(e: EventBusEmitInput): void {
    this.assertNoPayloadField(e);
    const evt: AppEvent = {
      type: e.type,
      ...('data' in e ? { payload: e.data } : {}),
      ...(e.meta !== undefined ? { meta: e.meta } : {}),
    };
    const set = this.handlers.get(evt.type);
    if (set) for (const handler of [...set]) this.invoke(handler, evt);
    for (const handler of [...this.anyHandlers]) this.invoke(handler, evt);
  }

  /**
   * Subscribe to a specific event `type`.
   *
   * If this is the first handler for the given `type`, a new `Set` is created.
   * Returns an unsubscribe function that removes the provided handler from the set.
   */
  on(type: string, handler: EventHandler): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);
    return () => set?.delete(handler);
  }

  /**
   * Subscribe to all events regardless of `type`.
   *
   * Returns an unsubscribe function that removes the handler from the `anyHandlers` set.
   */
  onAny(handler: EventHandler): () => void {
    this.anyHandlers.add(handler);
    return () => this.anyHandlers.delete(handler);
  }

  private assertNoPayloadField(e: EventBusEmitInput): void {
    if (!Object.prototype.hasOwnProperty.call(e, 'payload')) {
      return;
    }
    throw EngineErrorFactory.invalidInput({
      code: EngineErrorCode.CoreInvalidArgument,
      subsystem: EngineSubsystem.Core,
      message: 'EventBus.emit accepts data, not payload',
      details: {
        method: 'EventBus.emit',
        eventType: e.type,
      },
    });
  }
}
