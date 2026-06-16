import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { RuntimeSystemPhaseOrder } from './RuntimeSystemPhase';

import type { RuntimeSystem } from './types';
import type { Scene } from '@engine/scenes/SceneManager';

type RuntimeSystemKind = 'static' | 'dynamic';

export interface RuntimeSystemRegistrationOptions {
  staticSystem?: boolean;
}

export class RuntimeSystemRegistry<TScene extends Scene = Scene> {
  private readonly systemsByKey = new Map<string, RuntimeSystem<TScene>>();
  private readonly systemKindsByKey = new Map<string, RuntimeSystemKind>();
  private orderedSystems: readonly RuntimeSystem<TScene>[] = [];

  register(system: RuntimeSystem<TScene>, options?: RuntimeSystemRegistrationOptions): void {
    this.validateSystem(system);
    if (this.systemsByKey.has(system.key)) {
      throw EngineErrorFactory.conflict({
        code: EngineErrorCode.CoreInvalidConfig,
        subsystem: EngineSubsystem.Core,
        message: `Runtime system with key '${system.key}' is already registered`,
        details: { method: 'RuntimeScheduler.register', key: system.key },
      });
    }
    this.systemsByKey.set(system.key, system);
    this.systemKindsByKey.set(system.key, options?.staticSystem ? 'static' : 'dynamic');
    this.rebuildOrder();
  }

  deregister(key: string): void {
    if (!this.systemsByKey.delete(key)) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.CoreMissingRequired,
        subsystem: EngineSubsystem.Core,
        message: `Runtime system with key '${key}' is not registered`,
        details: { method: 'RuntimeScheduler.deregister', key },
      });
    }
    this.systemKindsByKey.delete(key);
    this.rebuildOrder();
  }

  getSystem(key: string): RuntimeSystem<TScene> | undefined {
    return this.systemsByKey.get(key);
  }

  getOrderedSystems(): readonly RuntimeSystem<TScene>[] {
    return this.orderedSystems;
  }

  getRegisteredKeys(): readonly string[] {
    return this.orderedSystems.map((system) => system.key);
  }

  snapshotDynamicSystemKeys(): ReadonlySet<string> {
    const keys = new Set<string>();
    for (const [key, kind] of this.systemKindsByKey) {
      if (kind === 'dynamic') {
        keys.add(key);
      }
    }
    return keys;
  }

  private validateSystem(system: RuntimeSystem<TScene>): void {
    if (system.key.trim().length === 0) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.CoreInvalidArgument,
        subsystem: EngineSubsystem.Core,
        message: 'Runtime system key must be a non-empty string',
        details: { method: 'RuntimeScheduler.validateSystem', key: system.key },
      });
    }
    if (!RuntimeSystemPhaseOrder.isValid(system.phase)) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.CoreInvalidArgument,
        subsystem: EngineSubsystem.Core,
        message: 'Runtime system phase must be a known value',
        details: {
          method: 'RuntimeScheduler.validateSystem',
          key: system.key,
          phase: system.phase,
        },
      });
    }
  }

  private rebuildOrder(): void {
    const ordered = Array.from(this.systemsByKey.values());
    ordered.sort((left, right) => {
      if (left.phase !== right.phase) {
        return RuntimeSystemPhaseOrder.compare(left.phase, right.phase);
      }
      return left.key.localeCompare(right.key);
    });
    this.orderedSystems = ordered;
  }
}
