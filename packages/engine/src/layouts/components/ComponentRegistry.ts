/**
 * Registry of component factories keyed by type name.
 *
 * Separates declarative layout from concrete component classes. Builders use this
 * registry to construct component instances by type during layout assembly.
 */
import type { BaseComponent } from './BaseComponent';

export class ComponentRegistry<TComponent extends BaseComponent = BaseComponent> {
  private map = new Map<string, () => TComponent>();
  /** Register a component factory under a type. */
  register(type: string, factory: () => TComponent): void {
    this.map.set(type, factory);
  }
  /** Retrieve a component factory if present. */
  get(type: string): (() => TComponent) | undefined {
    return this.map.get(type);
  }
}
