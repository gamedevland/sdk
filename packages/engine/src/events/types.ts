/**
 * Describes an application-level event flowing through the event bus.
 *
 * - `type`: Unique string identifier of the event. Use a stable, descriptive name.
 * - `payload`: Optional data carried by the event. Prefer serializable, minimal structures.
 * - `meta`: Optional metadata (e.g., timestamp, source, correlation id) useful for logging/tracing.
 *
 * @template T Shape of the `payload` object
 */
export interface AppEvent<T = unknown> {
  type: string;
  payload?: T;
  meta?: Record<string, unknown>;
}

/**
 * Public event emission contract.
 *
 * Emitters provide `data`; the event bus normalizes it to `AppEvent.payload`
 * before notifying subscribers. `payload` is intentionally forbidden here so
 * consumer code cannot accidentally bypass the public emit boundary.
 */
export interface EventBusEmitInput {
  type: string;
  data?: unknown;
  meta?: Record<string, unknown>;
  payload?: never;
}

/**
 * Function that handles a single dispatched event.
 *
 * Handlers may be synchronous or asynchronous. If a handler throws/rejects,
 * the event bus implementation decides how to handle the error (this engine's
 * default bus intentionally swallows handler errors to keep emitters safe).
 */
export type EventHandler = (e: AppEvent) => void | Promise<void>;

/**
 * Minimal event bus contract used across the engine.
 *
 * Implementations are expected to:
 * - Support subscribing by specific event `type` and an "any" catch‑all subscription
 * - Allow safe emission of events (handler errors must not crash the emitter)
 * - Return an unsubscribe function for every subscription
 */
export interface IEventBus {
  /**
   * Publish an event to all matching subscribers.
   *
   * Accepts a plain object with `type` and optional `data` (mapped to
   * `payload`) and `meta` fields.
   *
   * @param e Event to emit
   */
  emit(e: EventBusEmitInput): void;

  /**
   * Subscribe a handler to a specific event `type`.
   *
   * @param type Event type string to listen for
   * @param handler Function invoked for every matching event
   * @returns A function that removes this handler when called
   */
  on(type: string, handler: EventHandler): () => void;

  /**
   * Subscribe a handler to all events regardless of `type`.
   *
   * @param handler Function invoked for every emitted event
   * @returns A function that removes this handler when called
   */
  onAny(handler: EventHandler): () => void;
}
