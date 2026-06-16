import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '../errors';

import type { GameConfig } from './GameConfig';

export class EngineConfigInvariantValidator {
  validateStartConfig(config: GameConfig): void {
    if (!config.assets?.bundles) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.CoreInvalidConfig,
        subsystem: EngineSubsystem.Core,
        message: 'GameConfig.assets.bundles is required',
        details: { path: 'GameConfig.assets.bundles' },
      });
    }
    if (!config.scenes?.initial) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.CoreInvalidConfig,
        subsystem: EngineSubsystem.Core,
        message: 'GameConfig.scenes.initial is required',
        details: { path: 'GameConfig.scenes.initial' },
      });
    }
    if (!config.scenes?.map || !config.scenes.map[config.scenes.initial]) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.CoreInvalidConfig,
        subsystem: EngineSubsystem.Core,
        message: 'GameConfig.scenes.map must contain the initial scene key',
        details: { path: 'GameConfig.scenes.map', initialScene: config.scenes.initial },
      });
    }
  }

  validateTransitionTimeout(timeoutMs: number): void {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.CoreInvalidArgument,
        subsystem: EngineSubsystem.Core,
        message: 'Invalid scene lifecycle timeout: expected positive number',
        details: { timeoutMs: String(timeoutMs) },
      });
    }
  }
}
