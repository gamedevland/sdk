import type { Provider } from './types';

/**
 * Base class for DI provider groups.
 *
 * @remarks
 * Provider groups encapsulate how a set of providers is built so that
 * game configs can stay declarative and object-oriented.
 *
 * @example
 * class MyGroup extends ProviderGroup {
 *   toProviders() {
 *     return [];
 *   }
 * }
 * const providers = new MyGroup().toProviders();
 */
export abstract class ProviderGroup {
  /**
   * Convert the group into a flat list of DI providers.
   *
   * @returns {Provider[]} Providers ready to be registered in the container.
   * @example
   * const providers = group.toProviders();
   */
  abstract toProviders(): Provider[];
}
