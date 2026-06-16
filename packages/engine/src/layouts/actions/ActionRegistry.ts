/**
 * Registry of action factories, keyed by action type string from layout JSON.
 *
 * The registry decouples declarative layout from concrete action classes.
 * Builders resolve each action by type and construct instances via registered
 * factory functions (no DI container required here).
 */
import type { BaseAction } from './BaseAction';

export class ActionRegistry<TAction extends BaseAction = BaseAction> {
  private map = new Map<string, () => TAction>();
  /**
   * Register a factory for an action type.
   * Later registrations with the same type overwrite previous ones.
   */
  register(type: string, factory: () => TAction): void {
    this.map.set(type, factory);
  }
  /**
   * Get a factory for an action type, if registered.
   * Returns undefined when the type is any.
   */
  get(type: string): (() => TAction) | undefined {
    return this.map.get(type);
  }
}
