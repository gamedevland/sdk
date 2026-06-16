import type { PersistentStorageBackend } from './PersistentStorageBackend';
import type { PlatformDataStorageBackend } from '@engine/platforms';

export class WriteThroughPlatformPersistentStorageBackend implements PersistentStorageBackend {
  private platformBackendAvailable = true;

  constructor(
    private readonly platformBackend: PlatformDataStorageBackend,
    private readonly browserBackend: PersistentStorageBackend,
  ) {}

  async bootstrap(namespacePrefix: string): Promise<ReadonlyMap<string, string>> {
    const browserEntries = await this.browserBackend.bootstrap(namespacePrefix);
    if (!this.platformBackendAvailable) {
      return browserEntries;
    }

    try {
      const platformEntries = await this.platformBackend.bootstrap(namespacePrefix);
      return this.mergeEntries(browserEntries, platformEntries);
    } catch {
      this.disablePlatformBackend();
      return browserEntries;
    }
  }

  getItem(key: string): string | null {
    if (!this.platformBackendAvailable) {
      return this.browserBackend.getItem(key);
    }
    try {
      const value = this.platformBackend.getItem(key);
      if (value !== null) {
        return value;
      }
    } catch {
      this.disablePlatformBackend();
    }
    return this.browserBackend.getItem(key);
  }

  setItem(key: string, value: string): void {
    if (this.platformBackendAvailable) {
      try {
        this.platformBackend.setItem(key, value);
      } catch {
        this.disablePlatformBackend();
      }
    }
    this.browserBackend.setItem(key, value);
  }

  removeItem(key: string): void {
    if (this.platformBackendAvailable) {
      try {
        this.platformBackend.removeItem(key);
      } catch {
        this.disablePlatformBackend();
      }
    }
    this.browserBackend.removeItem(key);
  }

  private disablePlatformBackend(): void {
    this.platformBackendAvailable = false;
  }

  private mergeEntries(
    browserEntries: ReadonlyMap<string, string>,
    platformEntries: ReadonlyMap<string, string>,
  ): ReadonlyMap<string, string> {
    const merged = new Map(browserEntries);
    for (const [key, value] of platformEntries) {
      merged.set(key, value);
    }
    return merged;
  }
}
