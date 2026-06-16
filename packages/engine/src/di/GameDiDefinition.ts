import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { GlobalDiDefinition } from './GlobalDiDefinition';
import type { SceneDiConfig, SceneDiEntry } from './SceneDiConfig';
import type { SceneDiDefinition } from './SceneDiDefinition';
import type { Provider } from './types';

interface BuiltGameDiDefinition {
  readonly globalProviders: readonly Provider[];
  readonly scenes: SceneDiConfig;
}

export abstract class GameDiDefinition {
  protected abstract createGlobalDefinition(): GlobalDiDefinition;

  protected abstract createSceneDefinitions(): readonly SceneDiDefinition[];

  finalBuild(): BuiltGameDiDefinition {
    const globalProviders = this.createGlobalDefinition().finalBuildProviders();
    const scenes = this.buildSceneConfig(this.createSceneDefinitions());
    return {
      globalProviders,
      scenes,
    };
  }

  private buildSceneConfig(definitions: readonly SceneDiDefinition[]): SceneDiConfig {
    if (definitions.length === 0) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.DiInvalidConfig,
        subsystem: EngineSubsystem.Di,
        message: 'Scene definitions list must be non-empty',
        details: { legacyCode: 'DI_CFG_002', stage: 'di-build' },
      });
    }

    const scenes: Record<string, SceneDiEntry> = {};
    for (const definition of definitions) {
      const built = definition.finalBuild();
      if (built.sceneKey in scenes) {
        throw EngineErrorFactory.conflict({
          code: EngineErrorCode.DiDuplicateProvider,
          subsystem: EngineSubsystem.Di,
          message: 'Duplicate scene DI definition',
          details: { legacyCode: 'DI_CFG_003', stage: 'di-build', sceneKey: built.sceneKey },
        });
      }
      scenes[built.sceneKey] = {
        definition: built.definition,
        providers: built.providers,
        services: built.services,
      };
    }

    return { scenes };
  }
}
