import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { GameConfig } from '@engine/core/GameConfig';

export class EngineBootConfigPlan {
  private readonly engineStartBundleNames: readonly string[];
  private readonly sceneEnterBundleNamesByScene: Readonly<Record<string, readonly string[]>>;

  constructor(config: GameConfig) {
    this.engineStartBundleNames = this.normalizeBundleNames(
      config.system?.boot?.configs?.engineStartBundles ?? [],
    );
    this.sceneEnterBundleNamesByScene = this.buildSceneEnterBundleNamesByScene(config);
  }

  getEngineStartBundleNames(): readonly string[] {
    return this.engineStartBundleNames;
  }

  getSceneEnterBundleNames(sceneKey: string): readonly string[] {
    return this.sceneEnterBundleNamesByScene[sceneKey] ?? [];
  }

  private buildSceneEnterBundleNamesByScene(
    config: GameConfig,
  ): Readonly<Record<string, readonly string[]>> {
    const sceneEnter = config.system?.boot?.configs?.sceneEnterBundles ?? {};
    const knownSceneKeys = new Set<string>(Object.keys(config.scenes.map));
    const result: Record<string, readonly string[]> = {};

    for (const sceneKey of Object.keys(sceneEnter)) {
      if (!knownSceneKeys.has(sceneKey)) {
        throw EngineErrorFactory.invalidInput({
          code: EngineErrorCode.CoreInvalidConfig,
          subsystem: EngineSubsystem.Core,
          message: 'Scene boot config references unknown scene key',
          details: { method: 'EngineBootConfigPlan.buildSceneEnterBundleNamesByScene', sceneKey },
        });
      }
      result[sceneKey] = this.normalizeBundleNames(sceneEnter[sceneKey] ?? []);
    }

    return result;
  }

  private normalizeBundleNames(names: readonly string[]): readonly string[] {
    const unique = new Set<string>();
    const normalized: string[] = [];
    for (const name of names) {
      if (name.length === 0) {
        throw EngineErrorFactory.invalidInput({
          code: EngineErrorCode.CoreInvalidConfig,
          subsystem: EngineSubsystem.Core,
          message: 'Boot bundle name must be non-empty',
          details: { method: 'EngineBootConfigPlan.normalizeBundleNames' },
        });
      }
      if (unique.has(name)) {
        continue;
      }
      unique.add(name);
      normalized.push(name);
    }
    return normalized;
  }
}
