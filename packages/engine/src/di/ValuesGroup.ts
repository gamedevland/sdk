import { ProviderGroup } from './ProviderGroup';
import { DiTokens } from './tokens';

import type { DiContainerInterface, Provider } from './types';

/**
 * Factory function used to build a value via the DI container.
 *
 * @template T - Result type of the factory.
 * @param {DiContainerInterface} container - DI container for nested resolves.
 * @returns {T} Produced value.
 * @example
 * const factory: ValueFactory<number> = () => 42;
 */
export type ValueFactory<T> = (container: DiContainerInterface) => T;

/**
 * Provider group for value tokens (`value:*`).
 *
 * @remarks
 * Supports both factories and literal values while keeping DI config declarative.
 *
 * @example
 * const services = new ValuesGroup()
 *   .addValue('ApiBaseUrl', 'https://example.com')
 *   .addFactory('SettingsService', (c) => new SettingsService(c));
 */
export class ValuesGroup extends ProviderGroup {
  private readonly providers: Provider[] = [];

  /**
   * Register a value provider under a `value:*` token using a factory.
   *
   * @template T - Factory result type.
   * @param {string} name - Token name for `DiTokens.service(name)`.
   * @param {ValueFactory<T>} factory - Factory that can resolve other tokens.
   * @param {'singleton' | 'transient'} lifetime - Provider lifetime policy.
   * @returns {this} Fluent API for chaining.
   * @example
   * services.addFactory('LocalesService', (c) => new LocalesService(c), 'singleton');
   */
  addFactory<T>(
    name: string,
    factory: ValueFactory<T>,
    lifetime: 'singleton' | 'transient' = 'transient',
  ): this {
    this.providers.push({
      token: DiTokens.service(name),
      useFactory: factory,
      lifetime,
    });
    return this;
  }

  /**
   * Register a literal value under a `value:*` token.
   *
   * @template T - Value type.
   * @param {string} name - Token name for `DiTokens.service(name)`.
   * @param {T} value - Value to register.
   * @param {'singleton' | 'transient'} lifetime - Provider lifetime policy.
   * @returns {this} Fluent API for chaining.
   * @example
   * services.addValue('Version', '1.0.0');
   */
  addValue<T>(name: string, value: T, lifetime: 'singleton' | 'transient' = 'singleton'): this {
    this.providers.push({
      token: DiTokens.service(name),
      useValue: value,
      lifetime,
    });
    return this;
  }

  /**
   * Register a fully-formed provider as-is.
   *
   * @param {Provider} provider - Provider definition to include in the group.
   * @returns {this} Fluent API for chaining.
   * @example
   * services.addProvider({ token: DiTokens.service('Flag'), useValue: true });
   */
  addProvider(provider: Provider): this {
    this.providers.push(provider);
    return this;
  }

  /**
   * Convert all registrations into DI providers.
   *
   * @returns {Provider[]} Providers for value tokens.
   * @example
   * const providers = services.toProviders();
   */
  toProviders(): Provider[] {
    return [...this.providers];
  }
}
