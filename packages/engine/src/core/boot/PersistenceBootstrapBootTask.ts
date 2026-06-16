import { PersistentStorageCoordinator } from '@engine/configs';

import type { EngineBootTask } from './EngineBootTask';
import type { GameConfig } from '../GameConfig';
import type { PlatformManager } from '@engine/platforms';

export class PersistenceBootstrapBootTask implements EngineBootTask {
  constructor(
    private readonly config: GameConfig['system'] | undefined,
    private readonly platformManager: PlatformManager,
  ) {}

  async run(): Promise<void> {
    const persistence = this.config?.persistence;
    if (!persistence) {
      return;
    }
    PersistentStorageCoordinator.shared().configure({
      databaseName: persistence.indexedDB?.databaseName ?? 'engine-persistence',
      namespace: persistence.namespace,
      browserStorage: {
        localStorage: persistence.localStorage?.enabled ?? true,
        indexedDB: persistence.indexedDB?.enabled ?? true,
      },
      platformDataStorageBackend: this.platformManager.getDataStorageBackend(),
    });
    await PersistentStorageCoordinator.shared().bootstrap();
  }
}
