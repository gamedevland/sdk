import { RuntimeTypeGuards } from '@engine/common/RuntimeTypeGuards';
import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { AssetManager } from '@engine/assets';
import type { ElementConfig } from '@engine/layouts/types';

interface PrefabRecordShape {
  element?: unknown;
}

export class PrefabRepository {
  constructor(private readonly assets: AssetManager) {}

  async getElement(prefabId: string): Promise<ElementConfig> {
    const raw = await this.assets.getJson<unknown>(prefabId);
    const element = this.normalizePrefab(raw);
    return this.cloneElement(element);
  }

  private normalizePrefab(raw: unknown): ElementConfig {
    if (!RuntimeTypeGuards.isRecord(raw)) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.PrefabInvalidConfig,
        subsystem: EngineSubsystem.Prefab,
        message: 'Invalid prefab payload (expected object)',
        details: { method: 'PrefabRepository.normalizePrefab' },
      });
    }

    if (this.isElementConfig(raw)) {
      return raw;
    }

    const maybe = raw as PrefabRecordShape;
    if (!this.isElementConfig(maybe.element)) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.PrefabInvalidConfig,
        subsystem: EngineSubsystem.Prefab,
        message: "Invalid prefab payload (expected 'element' config)",
        details: { method: 'PrefabRepository.normalizePrefab' },
      });
    }
    return maybe.element;
  }

  private isElementConfig(value: unknown): value is ElementConfig {
    return RuntimeTypeGuards.isRecord(value) && typeof value['type'] === 'string';
  }

  private cloneElement(element: ElementConfig): ElementConfig {
    return JSON.parse(JSON.stringify(element)) as ElementConfig;
  }
}
