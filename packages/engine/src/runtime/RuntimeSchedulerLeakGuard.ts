import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { Scene } from '@engine/scenes/SceneManager';

export class RuntimeSchedulerLeakGuard {
  private static readonly EmptyKeys: ReadonlySet<string> = new Set<string>();
  private readonly baselineByScene = new WeakMap<Scene, ReadonlySet<string>>();

  captureBaseline(scene: Scene, dynamicKeys: ReadonlySet<string>): void {
    this.baselineByScene.set(scene, dynamicKeys);
  }

  assertClean(scene: Scene, currentDynamicKeys: ReadonlySet<string>): void {
    const baseline = this.baselineByScene.get(scene) ?? RuntimeSchedulerLeakGuard.EmptyKeys;
    const leaked: string[] = [];
    for (const key of currentDynamicKeys) {
      if (!baseline.has(key)) {
        leaked.push(key);
      }
    }
    this.baselineByScene.delete(scene);
    if (leaked.length === 0) {
      return;
    }
    throw EngineErrorFactory.invariant({
      code: EngineErrorCode.CoreInvariantViolation,
      subsystem: EngineSubsystem.Core,
      message: 'Runtime scheduler detected leaked dynamic system registrations after scene exit',
      details: {
        method: 'RuntimeSchedulerLeakGuard.assertClean',
        leakedKeys: leaked.join(','),
      },
    });
  }
}
