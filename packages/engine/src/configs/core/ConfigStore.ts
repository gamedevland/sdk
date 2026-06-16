import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';
import { SchemaDecoder } from '@engine/validation';

import type { AssetId } from '@engine/assets';
import type { Decoder } from '@engine/validation';

export class ConfigStore {
  private readonly configsById = new Map<AssetId, unknown>();

  has(id: AssetId): boolean {
    return this.configsById.has(id);
  }

  set(id: AssetId, value: unknown): void {
    this.configsById.set(id, value);
  }

  get<T = unknown>(id: AssetId): T | undefined;
  get<T>(id: AssetId, decoder: Decoder<T>): T;
  get<T = unknown>(id: AssetId, decoder?: Decoder<T>): T | undefined {
    const raw = this.configsById.get(id) as T | undefined;
    if (!decoder) {
      return raw;
    }
    if (raw === undefined) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.ConfigMissingRequired,
        subsystem: EngineSubsystem.Config,
        message: 'Config is not preloaded',
        details: { method: 'ConfigStore.get', configId: id },
      });
    }
    return SchemaDecoder.decode(raw, decoder, `ConfigStore.get('${id}')`);
  }

  getRequired<T = unknown>(id: AssetId): T {
    const value = this.get<T>(id);
    if (value !== undefined) {
      return value;
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.ConfigMissingRequired,
      subsystem: EngineSubsystem.Config,
      message: 'Config is not preloaded',
      details: { method: 'ConfigStore.getRequired', configId: id },
    });
  }
}
