import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { ValuesGroup } from './ValuesGroup';

import type { DiToken } from './tokens';
import type { DiContainerInterface } from './types';

type ProviderFactory<T> = (container: DiContainerInterface) => T;
type TokenizedClass<T> = (new () => T) & { readonly diToken?: string };

/**
 * OOP helper around ValuesGroup that keeps provider registration explicit
 * while reducing repetitive provider object boilerplate.
 */
export class ValuesGroupRegistrar {
  constructor(private readonly group: ValuesGroup = new ValuesGroup()) {}

  singletonValue<T>(token: DiToken<T>, value: T): this {
    this.group.addProvider({
      token,
      useValue: value,
      lifetime: 'singleton',
    });
    return this;
  }

  singletonFactory<T>(token: DiToken<T>, useFactory: ProviderFactory<T>): this {
    this.group.addProvider({
      token,
      useFactory,
      lifetime: 'singleton',
    });
    return this;
  }

  singletonClass<T>(token: DiToken<T>, useClass: new () => T): this {
    this.group.addProvider({
      token,
      useClass,
      lifetime: 'singleton',
    });
    return this;
  }

  transientClass<T>(token: DiToken<T>, useClass: new () => T): this {
    this.group.addProvider({
      token,
      useClass,
      lifetime: 'transient',
    });
    return this;
  }

  transientClassesByName<T>(
    tokenFactory: (name: string) => DiToken<T>,
    classes: readonly TokenizedClass<T>[],
  ): this {
    for (const cls of classes) {
      const name = cls.diToken ?? cls.name;
      if (!name) {
        throw EngineErrorFactory.invalidInput({
          code: EngineErrorCode.DiInvalidConfig,
          subsystem: EngineSubsystem.Di,
          message: 'Token name is required for transient class registration',
          details: { method: 'ValuesGroupRegistrar.transientClassesByName' },
        });
      }
      this.transientClass(tokenFactory(name), cls);
    }
    return this;
  }

  valueGroup(): ValuesGroup {
    return this.group;
  }
}
