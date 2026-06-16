import type { SceneEvent } from './types';

/**
 * Raw, unnormalized event coming from external sources (input, DOM, game code).
 *
 * The normalizer converts this shape into a `SceneEvent` understood by the FSM.
 */

export interface RawEvent {
  /** Event discriminator from the source (e.g., 'pointer.tap'). */
  type: string;
  /** Arbitrary payload; will be mapped to `SceneEvent.payload`. */
  data?: unknown;
  /** Optional metadata for diagnostics or tracing. */
  meta?: Record<string, unknown>;
}

/**
 * Converts a source-specific `RawEvent` into a normalized `SceneEvent`.
 *
 * Implement custom normalizers if you need to change naming or payload shape.
 */
export interface EventNormalizer {
  /** Map a raw event to the uniform `SceneEvent` contract. */
  normalize(raw: RawEvent): SceneEvent;
}

/**
 * The default, pass-through normalizer: it renames `data` to `payload` and
 * forwards `type` and `meta` unchanged.
 */
export class DefaultEventNormalizer implements EventNormalizer {
  /**
   * Normalize by projecting `{ type, data, meta }` to `{ type, payload, meta }`.
   */
  normalize(raw: RawEvent): SceneEvent {
    return {
      type: raw.type,
      payload: raw.data,
      ...(raw.meta !== undefined ? { meta: raw.meta } : {}),
    };
  }
}
