import type { CommandBus } from '../commands/CommandBus';
import type { AppEvent } from '@engine/events/types';
import type { SceneLayout } from '@engine/layouts';
import type { SceneRuntime } from '@engine/scenes/SceneRuntime';

/**
 * Finite State Machine (FSM) public types used by the scene flow subsystem.
 *
 * The FSM drives which scene "mode" is active, what commands are executed when
 * we enter a state, and how incoming events cause transitions between states.
 * These types are intentionally small and framework-agnostic so they can be
 * reused across different scenes.
 */

/**
 * Describes a normalized event that circulates inside the scene FSM.
 *
 * @template T Shape of the event payload. Defaults to a bag of any values.
 * @property type Event discriminator used to match transitions, e.g. "CLICK".
 * @property payload Optional data that handlers may consume.
 * @property meta Optional metadata (diagnostics, tracing, caller info, etc.).
 */
export type SceneEvent<T = unknown> = AppEvent<T>;

/**
 * A transition definition declared on a state for a particular event.
 *
 * @property target Name of the state to move to when this transition fires.
 * @property actions Optional list of command names to run during transition.
 * Commands execute sequentially and may be async.
 */
export interface TransitionRule {
  target?: string;
  actions?: string[];
}

/**
 * Declarative FSM description for a scene.
 *
 * Example:
 * {
 *   initial: 'idle',
 *   states: {
 *     idle: {
 *       entry: ['InitUI'],
 *       on: { START: { target: 'running', actions: ['PlaySound'] } }
 *     },
 *     running: { on: { STOP: { target: 'idle' } } }
 *   }
 * }
 */
export interface FSMConfig {
  /** Name of the state the FSM starts in. */
  initial: string;
  /** Mapping from state name to its configuration. */
  states: Record<string, FSMStateConfig>;
}

export interface FSMStateConfig {
  /** Actions (command names) to run when entering the state. */
  entry?: string[];
  /** Event name -> transition rule lookup for this state. */
  on?: Record<string, TransitionRule>;
}

/**
 * Runtime objects the FSM interacts with while executing.
 *
 * @property engine The core engine instance controlling timing and lifecycle.
 * @property layout Optional layout to which the FSM applies state styles.
 * @property bus A command bus used to run named commands on entries/transitions.
 */
export interface FSMContext {
  engine: SceneRuntime;
  layout?: SceneLayout;
  bus: CommandBus;
}
