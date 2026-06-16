import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { EventNormalizer, RawEvent } from './EventNormalizer';
import type { FSMConfig, FSMContext, SceneEvent, TransitionRule } from './types';

/**
 * A small, declarative finite state machine (FSM) used to drive scene flow.
 *
 * Responsibilities:
 * - Hold the current state and expose it via the `current` getter
 * - Execute entry actions and transition actions through the command bus
 * - Decide transitions based on normalized events
 *
 * Design notes:
 * - Transitions are atomic and awaited: actions run sequentially, then the
 *   state is updated, and entry actions of the new state
 *   are executed. This makes ordering predictable for junior developers.
 * - Exit actions are not part of the minimal design; add if needed in future.
 */
export class SceneFSM<TEvent extends SceneEvent = SceneEvent> {
  private state: string;
  private dispatchQueue: Promise<void> = Promise.resolve();
  private active = true;
  private lifecycleVersion = 0;

  /**
   * @param cfg Declarative FSM configuration (states, entry actions, rules)
   * @param ctx Runtime context (engine, layout, command bus)
   * @param normalizer Adapter that converts raw input into `SceneEvent`
   */
  constructor(
    private readonly cfg: FSMConfig,
    private readonly ctx: FSMContext,
    private readonly normalizer: EventNormalizer,
  ) {
    if (!cfg.states[cfg.initial]) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.FsmInvalidConfig,
        subsystem: EngineSubsystem.Fsm,
        message: 'Initial state is not declared in FSM config',
        details: { initial: cfg.initial, method: 'SceneFSM.constructor' },
      });
    }
    this.state = cfg.initial;
  }

  /** Current state name. */
  get current(): string {
    return this.state;
  }

  /**
   * Initialize the FSM.
   */
  async start(): Promise<void> {
    if (!this.active) {
      return;
    }
    await this.runEntry(this.state);
  }

  deactivate(): void {
    if (!this.active) {
      return;
    }
    this.active = false;
    this.lifecycleVersion += 1;
  }

  /**
   * Push an event into the FSM. Accepts either a `RawEvent` (will be
   * normalized) or an already-normalized `SceneEvent`.
   *
   * Subtlety: we detect pre-normalized events by the presence of `payload`.
   * Raw events use `data`, so the check is safe and cheap.
   */
  async dispatch(raw: RawEvent | TEvent): Promise<void> {
    if (!this.active) {
      return;
    }
    const lifecycleVersion = this.lifecycleVersion;
    const evt = ('payload' in raw ? raw : this.normalizer.normalize(raw)) as TEvent;
    const execute = async (): Promise<void> => {
      if (!this.isLifecycleVersionActive(lifecycleVersion)) {
        return;
      }
      // Read transition rule for current state and this event type
      const node = this.cfg.states[this.state];
      const tr = node?.on?.[evt.type];
      if (!tr) return; // no transition defined – ignore
      await this.runTransition(tr, evt, lifecycleVersion);
    };
    const scheduled = this.dispatchQueue.then(execute, execute);
    this.dispatchQueue = scheduled.then(
      () => undefined,
      () => undefined,
    );
    await scheduled;
  }

  /**
   * Perform a transition: run transition actions, update state, apply styles,
   * then execute entry actions of the target state.
   */
  private async runTransition(
    tr: TransitionRule,
    evt: TEvent,
    lifecycleVersion: number,
  ): Promise<void> {
    if (!this.isLifecycleVersionActive(lifecycleVersion)) {
      return;
    }
    // Minimal design: there are no explicit exit actions. We only run
    // transition actions (if any) before switching the state.
    if (tr.actions) {
      // Each command may be async; we await to keep ordering deterministic.
      for (const name of tr.actions) {
        if (!this.isLifecycleVersionActive(lifecycleVersion)) {
          return;
        }
        await this.ctx.bus.run(name, { event: evt, state: this.state });
      }
    }

    // Change state only when target is provided; otherwise stay in current state
    if (!this.isLifecycleVersionActive(lifecycleVersion)) {
      return;
    }
    if (tr.target) {
      if (!this.cfg.states[tr.target]) {
        throw EngineErrorFactory.invalidInput({
          code: EngineErrorCode.FsmInvalidState,
          subsystem: EngineSubsystem.Fsm,
          message: 'Transition target state is not declared in FSM config',
          details: { target: tr.target, current: this.state, method: 'SceneFSM.runTransition' },
        });
      }
      this.state = tr.target;
      // Finally, run entry actions of the new state
      await this.runEntry(this.state, lifecycleVersion);
    }
  }

  /**
   * Execute entry actions for a given state via the command bus.
   */
  private async runEntry(state: string, lifecycleVersion: number = this.lifecycleVersion): Promise<void> {
    if (!this.isLifecycleVersionActive(lifecycleVersion)) {
      return;
    }
    const node = this.cfg.states[state];
    if (!node?.entry) return;
    for (const name of node.entry) {
      if (!this.isLifecycleVersionActive(lifecycleVersion)) {
        return;
      }
      await this.ctx.bus.run(name, { state });
    }
  }

  private isLifecycleVersionActive(lifecycleVersion: number): boolean {
    return this.active && this.lifecycleVersion === lifecycleVersion;
  }
}
