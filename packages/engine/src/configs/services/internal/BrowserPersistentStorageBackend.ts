import { LocalStorageAdapter } from '../LocalStorageAdapter';

import type { IndexedDbStorageAdapter } from '../IndexedDbStorageAdapter';
import type { PersistentStorageBackend } from './PersistentStorageBackend';

type LocalStorageOperation = 'create' | 'getItem' | 'resolveNativeStorage' | 'setItem' | 'removeItem';

interface BrowserPersistentStorageBackendOptions {
  readonly indexedDb?: IndexedDbStorageAdapter;
  readonly localStorageEnabled: boolean;
}

export class BrowserPersistentStorageBackend implements PersistentStorageBackend {
  private localStorageAdapter: LocalStorageAdapter | undefined;

  constructor(private readonly options: BrowserPersistentStorageBackendOptions) {}

  async bootstrap(namespacePrefix: string): Promise<ReadonlyMap<string, string>> {
    const localStorageEntries = this.getLocalStorageEntriesByNamespace(namespacePrefix);
    const indexedDbEntries = await this.listIndexedDbEntries(namespacePrefix);
    const mergedEntries = new Map(localStorageEntries);

    for (const [key, value] of indexedDbEntries) {
      mergedEntries.set(key, value);
    }

    for (const [key, value] of mergedEntries) {
      this.setLocalStorageItem(key, value);
      await this.options.indexedDb?.setItem(key, value);
    }

    return mergedEntries;
  }

  getItem(key: string): string | null {
    const localStorageValue = this.getLocalStorageItem(key);
    if (localStorageValue !== null) {
      void this.options.indexedDb?.setItem(key, localStorageValue);
      return localStorageValue;
    }
    return null;
  }

  setItem(key: string, value: string): void {
    this.setLocalStorageItem(key, value);
    void this.options.indexedDb?.setItem(key, value);
  }

  removeItem(key: string): void {
    this.removeLocalStorageItem(key);
    void this.options.indexedDb?.removeItem(key);
  }

  private async listIndexedDbEntries(namespacePrefix: string): Promise<ReadonlyMap<string, string>> {
    const indexedDb = this.options.indexedDb;
    if (indexedDb === undefined) {
      return new Map<string, string>();
    }
    return indexedDb.listEntries(namespacePrefix);
  }

  private getLocalStorageItem(key: string): string | null {
    const adapter = this.resolveLocalStorageAdapter();
    if (!adapter) {
      return null;
    }
    try {
      return adapter.getItem(key);
    } catch (error: unknown) {
      this.localStorageAdapter = undefined;
      this.logLocalStorageError('getItem', key, error);
      return null;
    }
  }

  private setLocalStorageItem(key: string, value: string): void {
    const adapter = this.resolveLocalStorageAdapter();
    if (!adapter) {
      return;
    }
    try {
      adapter.setItem(key, value);
    } catch (error: unknown) {
      this.localStorageAdapter = undefined;
      this.logLocalStorageError('setItem', key, error);
    }
  }

  private removeLocalStorageItem(key: string): void {
    const adapter = this.resolveLocalStorageAdapter();
    if (!adapter) {
      return;
    }
    try {
      adapter.removeItem(key);
    } catch (error: unknown) {
      this.localStorageAdapter = undefined;
      this.logLocalStorageError('removeItem', key, error);
    }
  }

  private resolveLocalStorageAdapter(): LocalStorageAdapter | undefined {
    if (!this.options.localStorageEnabled) {
      return undefined;
    }
    const adapter = this.localStorageAdapter;
    if (adapter) {
      return adapter;
    }
    this.localStorageAdapter = this.tryCreateLocalStorageAdapter();
    return this.localStorageAdapter;
  }

  private tryCreateLocalStorageAdapter(): LocalStorageAdapter | undefined {
    try {
      return new LocalStorageAdapter();
    } catch (error: unknown) {
      this.logLocalStorageError('create', undefined, error);
      return undefined;
    }
  }

  private getLocalStorageEntriesByNamespace(namespacePrefix: string): Map<string, string> {
    const storage = this.resolveNativeLocalStorage();
    if (!storage) {
      return new Map<string, string>();
    }
    const entries = new Map<string, string>();
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key || !key.startsWith(namespacePrefix)) {
          continue;
        }
        const value = this.getLocalStorageItem(key);
        if (value !== null) {
          entries.set(key, value);
        }
      }
    } catch (error: unknown) {
      this.localStorageAdapter = undefined;
      this.logLocalStorageError('resolveNativeStorage', undefined, error);
      return new Map<string, string>();
    }
    return entries;
  }

  private resolveNativeLocalStorage(): Storage | undefined {
    try {
      const storage = globalThis.localStorage;
      if (storage) {
        return storage;
      }
      return undefined;
    } catch (error: unknown) {
      this.localStorageAdapter = undefined;
      this.logLocalStorageError('resolveNativeStorage', undefined, error);
      return undefined;
    }
  }

  private logLocalStorageError(
    operation: LocalStorageOperation,
    key: string | undefined,
    error: unknown,
  ): void {
    console.error('[BrowserPersistentStorageBackend] localStorage operation failed', {
      operation,
      key,
      error,
    });
  }
}
