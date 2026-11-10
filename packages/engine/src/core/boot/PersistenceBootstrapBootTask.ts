import { PersistentStorageCoordinator } from '@engine/configs';

import type { EngineBootTask } from './EngineBootTask';
import type { GameConfig } from '../GameConfig';
import type { PlatformManager } from '@engine/platforms';

export class PersistenceBootstrapBootTask implements EngineBootTask {
  constructor(
    private readonly config: GameConfig['system'] | undefined,
    private readonly platformManager: PlatformManager,
    private readonly coordinator: PersistentStorageCoordinator,
  ) {}

  async run(): Promise<void> {
    const persistence = this.config?.persistence;
    if (!persistence) {
      return;
    }
    this.coordinator.configure({
      policy: persistence.policy ?? 'platform-exclusive',
      databaseName: persistence.indexedDB?.databaseName ?? 'engine-persistence',
      namespace: persistence.namespace,
      browserStorage: {
        localStorage: persistence.localStorage?.enabled ?? true,
        indexedDB: persistence.indexedDB?.enabled ?? true,
      },
      platformDataStorageBackend: this.platformManager.getDataStorageBackend(),
    });
    await this.coordinator.bootstrap();
  }
}
