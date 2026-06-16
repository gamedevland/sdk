import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { SceneServiceTokenRegistry } from './SceneServiceTokenRegistry';
import { ValuesGroupRegistrar } from './ValuesGroupRegistrar';

import type { BuiltSceneDiEntry } from './SceneDiConfig';

export abstract class SceneDiDefinition {
  abstract getSceneKey(): string;

  protected abstract registerProviders(registrar: ValuesGroupRegistrar): void;

  protected abstract registerServices(services: SceneServiceTokenRegistry): void;

  finalBuild(): BuiltSceneDiEntry {
    const sceneKey = this.getSceneKey().trim();
    if (!sceneKey) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.DiInvalidConfig,
        subsystem: EngineSubsystem.Di,
        message: 'Scene key must be non-empty',
        details: {
          legacyCode: 'DI_CFG_006',
          stage: 'di-build',
          definition: this.definitionName(),
        },
      });
    }

    const providersRegistrar = new ValuesGroupRegistrar();
    this.registerProviders(providersRegistrar);

    const serviceRegistry = new SceneServiceTokenRegistry();
    this.registerServices(serviceRegistry);

    return {
      sceneKey,
      definition: this.definitionName(),
      providers: providersRegistrar.valueGroup().toProviders(),
      services: serviceRegistry.toTokens(),
    };
  }

  private definitionName(): string {
    const ctor = this.constructor as { name?: string };
    return ctor.name && ctor.name.length > 0 ? ctor.name : '[anonymous-scene-di-definition]';
  }
}
