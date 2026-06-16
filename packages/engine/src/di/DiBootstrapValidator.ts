import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { SceneDiConfig } from './SceneDiConfig';
import type { Provider, Token } from './types';

interface DiBootstrapValidationInput {
  readonly sceneKeysFromConfig: readonly string[];
  readonly sceneDiConfig: SceneDiConfig;
  readonly globalProviders: readonly Provider[];
}

export class DiBootstrapValidator {
  validate(input: DiBootstrapValidationInput): void {
    const sceneKeysFromConfig = new Set<string>(input.sceneKeysFromConfig);
    const sceneKeysFromDi = Object.keys(input.sceneDiConfig.scenes);

    if (sceneKeysFromDi.length === 0) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.DiInvalidConfig,
        subsystem: EngineSubsystem.Di,
        message: 'Scene DI definitions list must be non-empty',
        details: { legacyCode: 'DI_CFG_002', stage: 'di-validate' },
      });
    }

    for (const sceneKey of sceneKeysFromDi) {
      if (!sceneKeysFromConfig.has(sceneKey)) {
        throw EngineErrorFactory.invalidInput({
          code: EngineErrorCode.DiInvalidConfig,
          subsystem: EngineSubsystem.Di,
          message: 'Scene DI key is not present in scenes.map',
          details: { legacyCode: 'DI_CFG_004', stage: 'di-validate', sceneKey },
        });
      }
    }

    for (const sceneKey of sceneKeysFromConfig) {
      if (!(sceneKey in input.sceneDiConfig.scenes)) {
        throw EngineErrorFactory.invalidInput({
          code: EngineErrorCode.DiInvalidConfig,
          subsystem: EngineSubsystem.Di,
          message: 'scenes.map key has no scene DI definition',
          details: { legacyCode: 'DI_CFG_005', stage: 'di-validate', sceneKey },
        });
      }
    }

    this.validateSceneServiceResolvability(input.sceneDiConfig, input.globalProviders);
  }

  private validateSceneServiceResolvability(
    sceneDiConfig: SceneDiConfig,
    globalProviders: readonly Provider[],
  ): void {
    const globalTokens = this.collectProviderTokens(globalProviders);
    const sceneKeys = Object.keys(sceneDiConfig.scenes);
    for (const sceneKey of sceneKeys) {
      const entry = sceneDiConfig.scenes[sceneKey];
      if (!entry) continue;
      const sceneTokens = this.collectProviderTokens(entry.providers);
      for (const serviceToken of entry.services) {
        const key = this.tokenToKey(serviceToken);
        if (sceneTokens.has(key) || globalTokens.has(key)) {
          continue;
        }
        throw EngineErrorFactory.invalidInput({
          code: EngineErrorCode.DiUnresolvableToken,
          subsystem: EngineSubsystem.Di,
          message: 'Scene service token is not resolvable from scene/global providers',
          details: {
            legacyCode: 'DI_CFG_010',
            stage: 'di-validate',
            sceneKey,
            token: this.tokenToDebugString(serviceToken),
            definition: entry.definition,
          },
        });
      }
    }
  }

  private collectProviderTokens(providers: readonly Provider[]): Set<string> {
    const tokens = new Set<string>();
    for (const provider of providers) {
      tokens.add(this.tokenToKey(provider.token));
    }
    return tokens;
  }

  private tokenToKey(token: Token<unknown>): string {
    if (typeof token === 'string') return `s:${token}`;
    if (typeof token === 'symbol') return `y:${String(token)}`;
    if (typeof token === 'function') return `c:${token.name || '[anonymous-constructor]'}`;
    return `o:${token.key}`;
  }

  private tokenToDebugString(token: Token<unknown>): string {
    if (typeof token === 'string') return token;
    if (typeof token === 'symbol') return String(token);
    if (typeof token === 'function') return token.name || '[anonymous-constructor]';
    return token.key;
  }
}
