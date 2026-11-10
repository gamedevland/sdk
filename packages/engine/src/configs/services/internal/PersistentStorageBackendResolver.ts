import { IndexedDbStorageAdapter } from '../IndexedDbStorageAdapter';

import { BrowserPersistentStorageBackend } from './BrowserPersistentStorageBackend';
import { WriteThroughPlatformPersistentStorageBackend } from './WriteThroughPlatformPersistentStorageBackend';

import type { PersistentStorageBrowserConfig, PersistencePolicy } from '../PersistentStorageCoordinator';
import type { PersistentStorageBackend } from './PersistentStorageBackend';
import type { PlatformDataStorageBackend } from '@engine/platforms';

export class PersistentStorageBackendResolver {
  static create(
    databaseName: string,
    platformDataStorageBackend: PlatformDataStorageBackend | null,
    browserStorage: PersistentStorageBrowserConfig,
    policy: PersistencePolicy = 'platform-exclusive',
  ): PersistentStorageBackend {
    if (platformDataStorageBackend && policy === 'platform-exclusive') return platformDataStorageBackend;
    const browserBackend = browserStorage.indexedDB
      ? new BrowserPersistentStorageBackend({
          indexedDb: new IndexedDbStorageAdapter(databaseName),
          localStorageEnabled: browserStorage.localStorage,
        })
      : new BrowserPersistentStorageBackend({
          localStorageEnabled: browserStorage.localStorage,
        });
    if (!platformDataStorageBackend) {
      return browserBackend;
    }
    return new WriteThroughPlatformPersistentStorageBackend(platformDataStorageBackend, browserBackend);
  }
}
