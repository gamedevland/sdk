import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { ProviderGroup } from './ProviderGroup';
import { DiTokens } from './tokens';

import type { Provider } from './types';
import type { BaseComponent } from '@engine/layouts/components/BaseComponent';

/**
 * Component class type compatible with DI `useClass`.
 *
 * @template T - Concrete component type.
 * @example
 * class MyComponent extends BaseComponent {}
 * const cls: ComponentClass = MyComponent;
 */
export type ComponentClass<T extends BaseComponent = BaseComponent> = new () => T;

/**
 * Component class with an optional explicit DI token.
 *
 * @template T - Concrete component type.
 * @example
 * class MyComponent extends BaseComponent {
 *   static readonly diToken = 'MyComponent';
 * }
 */
export type ComponentTokenClass<T extends BaseComponent = BaseComponent> = ComponentClass<T> & {
  readonly diToken?: string;
};

/**
 * Provider group for layout components.
 *
 * @remarks
 * Produces `component:*` tokens with transient lifetime.
 *
 * @example
 * const components = new ComponentsGroup()
 *   .add('ButtonComponent', ButtonComponent);
 */
export class ComponentsGroup extends ProviderGroup {
  private readonly components = new Map<string, ComponentClass>();

  /**
   * Register a component class under a layout component name.
   *
   * @param {string} name - Layout component type name.
   * @param {ComponentClass} componentClass - Component constructor.
   * @returns {this} Fluent API for chaining.
   * @example
   * components.add('PopupCodeComponent', PopupCodeComponent);
   */
  add(name: string, componentClass: ComponentClass): this {
    this.components.set(name, componentClass);
    return this;
  }

  /**
   * Register a component class using its `diToken` field or class name.
   *
   * @param {ComponentTokenClass} componentClass - Component constructor with `diToken`.
   * @returns {this} Fluent API for chaining.
   * @throws {Error} If neither `diToken` nor class name is available.
   * @example
   * components.addByToken(SpawnStickerButtonComponent);
   */
  addByToken(componentClass: ComponentTokenClass): this {
    const token = componentClass.diToken || componentClass.name;
    if (!token) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.DiInvalidConfig,
        subsystem: EngineSubsystem.Di,
        message: 'Component token is required',
        details: { method: 'ComponentsGroup.addByToken' },
      });
    }
    return this.add(token, componentClass);
  }

  /**
   * Convert all component registrations into DI providers.
   *
   * @returns {Provider[]} Providers for components.
   * @example
   * const providers = components.toProviders();
   */
  toProviders(): Provider[] {
    const providers: Provider[] = [];
    for (const [name, componentClass] of this.components.entries()) {
      providers.push({
        token: DiTokens.component(name),
        useClass: componentClass,
        lifetime: 'transient',
      });
    }
    return providers;
  }
}
