import { CommandsGroup } from './CommandsGroup';
import { ComponentsGroup } from './ComponentsGroup';
import { ElementFactoriesGroup } from './ElementFactoriesGroup';
import { ValuesGroup } from './ValuesGroup';

import type { ProviderGroup } from './ProviderGroup';
import type { Provider } from './types';

/**
 * Construction options for `GameDiConfig`.
 *
 * @example
 * const config = new GameDiConfig({ services: new ValuesGroup() });
 */
export interface GameDiConfigOptions {
  /** Element factory group (layout nodes). */
  elements?: ElementFactoriesGroup;
  /** Layout component group. */
  components?: ComponentsGroup;
  /** Command group. */
  commands?: CommandsGroup;
  /** Service/value group. */
  services?: ProviderGroup;
}

/**
 * High-level, object-oriented DI config for game modules.
 *
 * @remarks
 * Aggregates provider groups into a single `Provider[]` for container registration.
 *
 * @example
 * const config = new GameDiConfig();
 * config.elements.add('Container', ContainerNode);
 */
export class GameDiConfig {
  private readonly elementsGroup: ElementFactoriesGroup;
  private readonly componentsGroup: ComponentsGroup;
  private readonly commandsGroup: CommandsGroup;
  private readonly servicesGroup: ProviderGroup;

  /**
   * Create a new game DI config with optional prebuilt groups.
   *
   * @param {GameDiConfigOptions} options - Preconfigured provider groups.
   * @example
   * const config = new GameDiConfig({
   *   services: new ValuesGroup(),
   * });
   */
  constructor(options?: GameDiConfigOptions) {
    this.elementsGroup =
      options && options.elements ? options.elements : new ElementFactoriesGroup();
    this.componentsGroup =
      options && options.components ? options.components : new ComponentsGroup();
    this.commandsGroup = options && options.commands ? options.commands : new CommandsGroup();
    this.servicesGroup = options && options.services ? options.services : new ValuesGroup();
  }

  /**
   * Access element factories group.
   *
   * @returns {ElementFactoriesGroup} Element factories group.
   * @example
   * config.elements.add('Sprite', SpriteNode);
   */
  get elements(): ElementFactoriesGroup {
    return this.elementsGroup;
  }

  /**
   * Access components group.
   *
   * @returns {ComponentsGroup} Components group.
   * @example
   * config.components.add('ButtonComponent', ButtonComponent);
   */
  get components(): ComponentsGroup {
    return this.componentsGroup;
  }

  /**
   * Access commands group.
   *
   * @returns {CommandsGroup} Commands group.
   * @example
   * config.commands.add('OpenDoor', OpenDoorCommand);
   */
  get commands(): CommandsGroup {
    return this.commandsGroup;
  }

  /**
   * Access services group.
   *
   * @returns {ProviderGroup} Services group.
   * @example
   * config.services.addFactory('LocalesService', (c) => new LocalesService(c));
   */
  get services(): ProviderGroup {
    return this.servicesGroup;
  }

  /**
   * Build a flat list of providers from all groups.
   *
   * @returns {Provider[]} Providers ready for registration.
   * @example
   * const providers = config.buildProviders();
   */
  buildProviders(): Provider[] {
    const providers: Provider[] = [];
    providers.push(...this.elementsGroup.toProviders());
    providers.push(...this.componentsGroup.toProviders());
    providers.push(...this.commandsGroup.toProviders());
    providers.push(...this.servicesGroup.toProviders());
    return providers.map((provider) => ({ ...provider, source: provider.source ?? 'game' }));
  }
}
