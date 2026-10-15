/** Hardware/source type of the pointer producing the event. */
export type PointerType = 'mouse' | 'touch' | 'pen';

/** Native terminal condition that ended an active drag gesture. */
export type DragEndReason = 'pointerup' | 'pointercancel';

/** Canonical input event types routed by the input subsystem. */
export type InputType =
  | 'pointerdown'
  | 'pointerup'
  | 'pointercancel'
  | 'pointermove'
  | 'tap'
  | 'dragstart'
  | 'drag'
  | 'dragend'
  | 'wheel';

/**
 * Unified input event payload delivered to handlers and the input channel.
 * `target` fields are optional and populated when hit-testing resolves a node/display object.
 * `delta` is used for wheel events (x/y/z components are optional).
 */
export type HitTarget = {
  id?: string;
  node?: unknown;
  displayObject?: unknown;
};

export interface InputEventBase {
  type: InputType;
  time: number;
  pointerId: number;
  pointerType: PointerType;
  /** Native pointer metadata; absent on synthetic and wheel events. */
  button?: number;
  buttons?: number;
  isPrimary?: boolean;
  screen: { x: number; y: number };
  virtual: { x: number; y: number };
  dragEndReason?: DragEndReason;
  delta?: { x?: number; y?: number; z?: number };
  target?: HitTarget;
  stopPropagation(): void;
  isPropagationStopped(): boolean;
}

/** Function signature for input event listeners. */
export type InputHandler = (e: InputEventBase) => void;

/** Event shape produced by the manager before routing (no propagation methods yet). */
export type EngineInputEventInit = Omit<InputEventBase, 'stopPropagation' | 'isPropagationStopped'>;
