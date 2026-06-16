import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';
import { SchemaDecoder } from '@engine/validation';

import type { SettingsEntry } from './SettingsEntry';
import type { ConfigStore } from '../core/ConfigStore';

/** Arbitrary key-value game settings. */
export type Settings = Record<string, unknown>;

/**
 * Unified settings service backed by ConfigStore.
 * Resolves any settings file, then decodes a specific key within it.
 */
export class SettingsService {
  private static readonly SettingsDecoder = SchemaDecoder.record();

  constructor(private readonly configStore: ConfigStore) {}

  /** Read and decode a settings value using a pre-declared SettingsEntry descriptor. */
  read<T>(entry: SettingsEntry<T>): T {
    const settings = this.getRequiredSettings(entry.fileId);
    return SchemaDecoder.decode(
      settings[entry.key],
      entry.decoder,
      `SettingsService.read('${entry.fileId}' -> '${entry.key}')`,
    );
  }

  private getRequiredSettings(fileId: string): Settings {
    try {
      return this.configStore.get(fileId, SettingsService.SettingsDecoder);
    } catch (error) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.ConfigMissingRequired,
        subsystem: EngineSubsystem.Config,
        message: 'Settings are not preloaded',
        details: {
          method: 'SettingsService.getRequiredSettings',
          configId: fileId,
        },
        cause: error,
      });
    }
  }
}
