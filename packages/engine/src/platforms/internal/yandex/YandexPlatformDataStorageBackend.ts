import type { YandexPlayerApi, YandexPlayerDataObject } from './YandexSdkContract';
import type { PlatformDataStorageBackend } from '../../types';

/**
 * Platform-owned storage bridge backed by Yandex Player in-game data.
 */
export class YandexPlatformDataStorageBackend implements PlatformDataStorageBackend {
  private static readonly PERSIST_FLUSH = false;

  private readonly data = new Map<string, string>();
  private loadPromise: Promise<void> | undefined;
  private persistChain: Promise<void> = Promise.resolve();
  private persistenceDisabled = false;

  constructor(private readonly player: YandexPlayerApi) {}

  async bootstrap(namespacePrefix: string): Promise<ReadonlyMap<string, string>> {
    await this.ensureLoaded();

    const snapshot = new Map<string, string>();
    for (const [key, value] of this.data) {
      if (key.startsWith(namespacePrefix)) {
        snapshot.set(key, value);
      }
    }
    return snapshot;
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
    this.schedulePersist();
  }

  removeItem(key: string): void {
    this.data.delete(key);
    this.schedulePersist();
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.loadDataSnapshot();
    }
    await this.loadPromise;
  }

  private async loadDataSnapshot(): Promise<void> {
    const data = await this.player.getData();
    this.data.clear();

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        this.data.set(key, value);
      }
    }
  }

  private schedulePersist(): void {
    if (this.persistenceDisabled) {
      return;
    }

    const payload = this.createPayloadSnapshot();
    this.persistChain = this.persistChain
      .then(() => this.player.setData(payload, YandexPlatformDataStorageBackend.PERSIST_FLUSH))
      .then(() => undefined)
      .catch(() => {
        this.persistenceDisabled = true;
      });
  }

  private createPayloadSnapshot(): YandexPlayerDataObject {
    const payload: Record<string, string> = {};
    for (const [key, value] of this.data) {
      payload[key] = value;
    }
    return payload;
  }
}
