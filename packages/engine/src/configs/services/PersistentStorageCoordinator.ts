import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { PersistentStorageBackendResolver } from './internal/PersistentStorageBackendResolver';

import type { PersistentStorageBackend } from './internal/PersistentStorageBackend';
import type { PlatformDataStorageBackend } from '@engine/platforms';

interface PersistentStorageConfig {
  readonly databaseName: string;
  readonly namespace: string;
  readonly browserStorage: PersistentStorageBrowserConfig;
  readonly platformDataStorageBackend: PlatformDataStorageBackend | null;
}

export interface PersistentStorageBrowserConfig {
  readonly localStorage: boolean;
  readonly indexedDB: boolean;
}

export class PersistentStorageCoordinator {
  private static sharedInstance: PersistentStorageCoordinator | undefined;
  private static readonly DEFAULT_DATABASE_NAME = 'engine-persistence';

  private readonly cache = new Map<string, string>();
  private readonly knownKeys = new Set<string>();
  private bootstrapPromise: Promise<void> | undefined;
  private storageBackend: PersistentStorageBackend | undefined;
  private config: PersistentStorageConfig = {
    databaseName: PersistentStorageCoordinator.DEFAULT_DATABASE_NAME,
    namespace: '',
    browserStorage: {
      localStorage: true,
      indexedDB: true,
    },
    platformDataStorageBackend: null,
  };

  static shared(): PersistentStorageCoordinator {
    if (!PersistentStorageCoordinator.sharedInstance) {
      PersistentStorageCoordinator.sharedInstance = new PersistentStorageCoordinator();
    }
    return PersistentStorageCoordinator.sharedInstance;
  }

  configure(config: PersistentStorageConfig): void {
    this.validateConfig(config);
    if (
      this.config.databaseName === config.databaseName &&
      this.config.namespace === config.namespace &&
      this.config.browserStorage.localStorage === config.browserStorage.localStorage &&
      this.config.browserStorage.indexedDB === config.browserStorage.indexedDB &&
      this.config.platformDataStorageBackend === config.platformDataStorageBackend
    ) {
      return;
    }
    this.config = config;
    this.bootstrapPromise = undefined;
    this.cache.clear();
    this.knownKeys.clear();
    this.storageBackend = undefined;
  }

  async bootstrap(): Promise<void> {
    if (!this.bootstrapPromise) {
      this.bootstrapPromise = this.bootstrapNamespace();
    }
    await this.bootstrapPromise;
  }

  getItem(key: string): string | null {
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    if (this.knownKeys.has(key)) {
      return null;
    }
    const storedValue = this.getRequiredStorageBackend().getItem(key);
    this.knownKeys.add(key);
    if (storedValue !== null) {
      this.cache.set(key, storedValue);
    }
    return storedValue;
  }

  setItem(key: string, value: string): void {
    this.knownKeys.add(key);
    this.cache.set(key, value);
    this.getRequiredStorageBackend().setItem(key, value);
  }

  removeItem(key: string): void {
    this.knownKeys.add(key);
    this.cache.delete(key);
    this.getRequiredStorageBackend().removeItem(key);
  }

  private async bootstrapNamespace(): Promise<void> {
    const entries = await this.getRequiredStorageBackend().bootstrap(this.resolveNamespacePrefix());

    this.cache.clear();
    this.knownKeys.clear();
    for (const [key, value] of entries) {
      this.knownKeys.add(key);
      this.cache.set(key, value);
    }
  }

  private getRequiredStorageBackend(): PersistentStorageBackend {
    const backend = this.storageBackend;
    if (backend) {
      return backend;
    }
    this.storageBackend = PersistentStorageBackendResolver.create(
      this.config.databaseName,
      this.config.platformDataStorageBackend,
      this.config.browserStorage,
    );
    return this.storageBackend;
  }

  private resolveNamespacePrefix(): string {
    const namespace = this.config.namespace.trim();
    return namespace.length > 0 ? `${namespace}:` : '';
  }

  private validateConfig(config: PersistentStorageConfig): void {
    if (config.namespace.trim().length > 0) {
      this.validateStorageConfig(config);
      return;
    }
    throw EngineErrorFactory.invalidInput({
      code: EngineErrorCode.ConfigInvalidArgument,
      subsystem: EngineSubsystem.Config,
      message: 'Persistence namespace must be a non-empty string',
      details: {
        method: 'PersistentStorageCoordinator.configure',
        databaseName: config.databaseName,
        namespace: config.namespace,
      },
    });
  }

  private validateStorageConfig(config: PersistentStorageConfig): void {
    if (
      config.browserStorage.localStorage
      || config.browserStorage.indexedDB
      || config.platformDataStorageBackend !== null
    ) {
      return;
    }

    throw EngineErrorFactory.invalidInput({
      code: EngineErrorCode.ConfigInvalidArgument,
      subsystem: EngineSubsystem.Config,
      message: 'Persistence must enable at least one storage backend',
      details: {
        method: 'PersistentStorageCoordinator.configure',
        databaseName: config.databaseName,
        namespace: config.namespace,
        localStorage: config.browserStorage.localStorage,
        indexedDB: config.browserStorage.indexedDB,
      },
    });
  }
}
