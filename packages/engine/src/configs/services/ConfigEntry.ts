import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { Decoder } from '@engine/validation';

export type JsonConfigPath = `json/configs/${string}.json`;

/**
 * Typed descriptor for a single JSON config file and decoder pair.
 * Declare as a static readonly field in feature schemas and pass it to
 * `DecodedConfigStore.getByEntry(entry)` at runtime.
 */
export class ConfigEntry<TFileId extends JsonConfigPath, TValue> {
  private static readonly FILE_ID_PATTERN = /^json\/configs\/.+\.json$/;

  constructor(
    readonly fileId: TFileId,
    readonly decoder: Decoder<TValue>,
  ) {
    ConfigEntry.assertFileId(fileId);
  }

  private static assertFileId(fileId: string): void {
    if (!ConfigEntry.FILE_ID_PATTERN.test(fileId)) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.ConfigInvalidArgument,
        subsystem: EngineSubsystem.Config,
        details: {
          method: 'ConfigEntry.assertFileId',
          fileId,
          expected: 'json/configs/<name>.json',
        },
      });
    }
  }
}
