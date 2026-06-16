import { CommandsGroup } from './CommandsGroup';
import { ComponentsGroup } from './ComponentsGroup';
import { ElementFactoriesGroup } from './ElementFactoriesGroup';
import { GameDiConfig } from './GameDiConfig';
import { ValuesGroupRegistrar } from './ValuesGroupRegistrar';

import type { Provider } from './types';

export abstract class GlobalDiDefinition {
  protected abstract registerElements(group: ElementFactoriesGroup): void;

  protected abstract registerComponents(group: ComponentsGroup): void;

  protected abstract registerCommands(group: CommandsGroup): void;

  protected abstract registerServices(registrar: ValuesGroupRegistrar): void;

  finalBuildProviders(): readonly Provider[] {
    const elements = new ElementFactoriesGroup();
    const components = new ComponentsGroup();
    const commands = new CommandsGroup();
    const servicesRegistrar = new ValuesGroupRegistrar();

    this.registerElements(elements);
    this.registerComponents(components);
    this.registerCommands(commands);
    this.registerServices(servicesRegistrar);

    const config = new GameDiConfig({
      elements,
      components,
      commands,
      services: servicesRegistrar.valueGroup(),
    });

    return config.buildProviders();
  }
}

