import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { IStorageAdapter } from '../core/types';

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Browser localStorage adapter.
 *
 * @remarks
 * Throws explicit errors when Storage API is unavailable.
 */
export class LocalStorageAdapter implements IStorageAdapter {
  constructor(private readonly storage: BrowserStorage = LocalStorageAdapter.resolveStorage()) {}

  getItem(key: string): string | null {
    return this.storage.getItem(key);
  }

  setItem(key: string, value: string): void {
    this.storage.setItem(key, value);
  }

  removeItem(key: string): void {
    this.storage.removeItem(key);
  }

  private static resolveStorage(): BrowserStorage {
    const runtime = globalThis as typeof globalThis & { localStorage?: Storage };
    const storage = runtime.localStorage;
    if (!storage) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.ConfigMissingRequired,
        subsystem: EngineSubsystem.Config,
        message: 'globalThis.localStorage is not available',
        details: { method: 'LocalStorageAdapter.resolveStorage' },
      });
    }
    return storage;
  }
}
