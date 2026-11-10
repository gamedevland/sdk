type IndexedDbOperation = 'open' | 'getItem' | 'listEntries' | 'setItem' | 'removeItem';

export class IndexedDbStorageAdapter {
  private static readonly DATABASE_VERSION = 1;
  private static readonly STORE_NAME = 'kv';

  private databasePromise: Promise<IDBDatabase | undefined> | undefined;

  constructor(private readonly databaseName: string) {}

  async getItem(key: string): Promise<string | null> {
    const database = await this.getDatabase();
    if (!database) {
      return null;
    }
    return await new Promise<string | null>((resolve) => {
      const transaction = database.transaction(IndexedDbStorageAdapter.STORE_NAME, 'readonly');
      const store = transaction.objectStore(IndexedDbStorageAdapter.STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => {
        resolve(typeof request.result === 'string' ? request.result : null);
      };
      request.onerror = () => {
        this.logStorageError('getItem', key, request.error);
        resolve(null);
      };
    });
  }

  async listEntries(prefix: string): Promise<Map<string, string>> {
    const database = await this.getDatabase();
    if (!database) {
      return new Map<string, string>();
    }
    return await new Promise<Map<string, string>>((resolve) => {
      const entries = new Map<string, string>();
      const transaction = database.transaction(IndexedDbStorageAdapter.STORE_NAME, 'readonly');
      const store = transaction.objectStore(IndexedDbStorageAdapter.STORE_NAME);
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(entries);
          return;
        }
        const key = cursor.key;
        if (
          typeof key === 'string' &&
          key.startsWith(prefix) &&
          typeof cursor.value === 'string'
        ) {
          entries.set(key, cursor.value);
        }
        cursor.continue();
      };
      request.onerror = () => {
        this.logStorageError('listEntries', prefix, request.error);
        resolve(new Map<string, string>());
      };
      transaction.onabort = () => {
        this.logStorageError('listEntries', prefix, transaction.error);
        resolve(new Map<string, string>());
      };
    });
  }

  async setItem(key: string, value: string): Promise<void> {
    const database = await this.getDatabase();
    if (!database) {
      return;
    }
    await new Promise<void>((resolve) => {
      const transaction = database.transaction(IndexedDbStorageAdapter.STORE_NAME, 'readwrite');
      const store = transaction.objectStore(IndexedDbStorageAdapter.STORE_NAME);
      store.put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        this.logStorageError('setItem', key, transaction.error);
        resolve();
      };
      transaction.onabort = () => {
        this.logStorageError('setItem', key, transaction.error);
        resolve();
      };
    });
  }

  async removeItem(key: string): Promise<void> {
    const database = await this.getDatabase();
    if (!database) {
      return;
    }
    await new Promise<void>((resolve) => {
      const transaction = database.transaction(IndexedDbStorageAdapter.STORE_NAME, 'readwrite');
      const store = transaction.objectStore(IndexedDbStorageAdapter.STORE_NAME);
      store.delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        this.logStorageError('removeItem', key, transaction.error);
        resolve();
      };
      transaction.onabort = () => {
        this.logStorageError('removeItem', key, transaction.error);
        resolve();
      };
    });
  }

  private async getDatabase(): Promise<IDBDatabase | undefined> {
    if (!this.databasePromise) {
      this.databasePromise = this.openDatabase();
    }
    return await this.databasePromise;
  }

  private async openDatabase(): Promise<IDBDatabase | undefined> {
    let factory: IDBFactory | undefined;
    try {
      factory = globalThis.indexedDB;
    } catch (error: unknown) {
      this.logStorageError('open', undefined, error);
      return undefined;
    }
    if (!factory) {
      this.logStorageError('open', undefined, new Error('globalThis.indexedDB is not available'));
      return undefined;
    }

    return await new Promise<IDBDatabase | undefined>((resolve) => {
      let request: IDBOpenDBRequest;
      try {
        request = factory.open(
          this.databaseName,
          IndexedDbStorageAdapter.DATABASE_VERSION,
        );
      } catch (error: unknown) {
        this.logStorageError('open', undefined, error);
        resolve(undefined);
        return;
      }
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(IndexedDbStorageAdapter.STORE_NAME)) {
          database.createObjectStore(IndexedDbStorageAdapter.STORE_NAME);
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onclose = () => {
          this.databasePromise = undefined;
        };
        resolve(database);
      };
      request.onerror = () => {
        this.logStorageError('open', undefined, request.error);
        resolve(undefined);
      };
      request.onblocked = () => {
        this.logStorageError('open', undefined, new Error('IndexedDB open request is blocked'));
        resolve(undefined);
      };
    });
  }

  private logStorageError(operation: IndexedDbOperation, key: string | undefined, error: unknown): void {
    console.error('[IndexedDbStorageAdapter] IndexedDB operation failed', {
      databaseName: this.databaseName,
      operation,
      key,
      error: error instanceof Error ? { name: error.name, message: error.message } : error,
    });
  }
}
