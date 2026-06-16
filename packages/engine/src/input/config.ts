/**
 * Tuning knobs for input recognition and normalization.
 * All fields are optional; defaults are applied via defaultInputConfig.
 */
export interface InputConfig {
  /** Maximum pointer travel in virtual pixels to still qualify as a tap. */
  tapMaxDistance?: number; // px
  /** Maximum time between down and up to qualify as a tap. */
  tapMaxDuration?: number; // ms
  /** Maximum delay between two taps to be considered a double-tap (reserved). */
  doubleTapTimeout?: number; // ms
  /** Press duration to consider as long-press (reserved). */
  longPressDuration?: number; // ms
  /** Movement threshold from down to start a drag. */
  dragStartDistance?: number; // px
  /** Optional throttle for move events (0 disables throttling). */
  throttleMoveMs?: number; // ms
  /** Multiplier applied to wheel delta components. */
  wheelScale?: number; // multiplier
}

export const defaultInputConfig: Required<
  Pick<
    InputConfig,
    | 'tapMaxDistance'
    | 'tapMaxDuration'
    | 'doubleTapTimeout'
    | 'longPressDuration'
    | 'dragStartDistance'
    | 'throttleMoveMs'
    | 'wheelScale'
  >
> = {
  tapMaxDistance: 8,
  tapMaxDuration: 220,
  doubleTapTimeout: 280,
  longPressDuration: 450,
  dragStartDistance: 6,
  throttleMoveMs: 0,
  wheelScale: 1,
};
