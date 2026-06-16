import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

/**
 * Namespaced key composer for persistent state storage.
 *
 * @remarks
 * Prevents accidental key collisions across apps/games/modules.
 */
export class StorageNamespace {
  constructor(private readonly namespace: string) {
    if (!namespace || namespace.trim().length === 0) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.ConfigInvalidArgument,
        subsystem: EngineSubsystem.Config,
        message: 'Namespace must be a non-empty string',
        details: { method: 'StorageNamespace.constructor' },
      });
    }
  }

  key(localKey: string): string {
    if (!localKey || localKey.trim().length === 0) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.ConfigInvalidArgument,
        subsystem: EngineSubsystem.Config,
        message: 'localKey must be a non-empty string',
        details: { method: 'StorageNamespace.key' },
      });
    }
    return `${this.namespace}:${localKey}`;
  }
}
