/**
 * Mutable collection of actions attached to a node, accessible by id.
 *
 * Provides lookup and execution helpers.
 */
import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { BaseAction } from '../../actions/BaseAction';

type RuntimeClass<T> = abstract new (...args: never[]) => T;

export class NodeActions {
  private readonly actions = new Map<string, BaseAction>();

  /** Add/replace an action under an id. */
  addAction(id: string, action: BaseAction): void {
    this.actions.set(id, action);
  }

  /** Get an action by id or throw if missing. */
  getAction(id: string): BaseAction {
    const action = this.actions.get(id);
    if (!action) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.LayoutMissingRequired,
        subsystem: EngineSubsystem.Layout,
        message: 'Action is not found',
        details: { id, method: 'NodeActions.getAction' },
      });
    }
    return action;
  }

  /** Get an action by class or throw if missing/ambiguous. */
  getActionByType<TAction extends BaseAction>(expectedType: RuntimeClass<TAction>): TAction {
    const matches: BaseAction[] = [];
    for (const action of this.actions.values()) {
      if (action instanceof expectedType) {
        matches.push(action);
      }
    }

    if (matches.length === 0) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.LayoutMissingRequired,
        subsystem: EngineSubsystem.Layout,
        message: 'Action type is not attached',
        details: { type: expectedType.name, method: 'NodeActions.getActionByType' },
      });
    }
    if (matches.length > 1) {
      throw EngineErrorFactory.conflict({
        code: EngineErrorCode.LayoutConflict,
        subsystem: EngineSubsystem.Layout,
        message: 'Action type is ambiguous',
        details: { type: expectedType.name, matches: matches.length },
      });
    }

    return matches[0] as TAction;
  }

  /** Run an action by id. */
  runAction(id: string, data?: Record<string, unknown>): Promise<void> {
    const a = this.getAction(id);
    return a.invoke(data);
  }

  /** Cancel an action by id without detaching it from the node. */
  cancelAction(id: string): void {
    this.getAction(id).cancel();
  }

  /**
   * Dispose all actions by calling their optional onDetach hook and clear storage.
   */
  async destroy(): Promise<void> {
    const errors: unknown[] = [];
    for (const action of this.actions.values()) {
      try { await action.onDetach(); } catch (error) { errors.push(error); }
      try { await action.completeDetach(); } catch (error) { errors.push(error); }
    }
    this.actions.clear();
    if (errors.length) throw new AggregateError(errors, 'Action cleanup failed');
  }
}
