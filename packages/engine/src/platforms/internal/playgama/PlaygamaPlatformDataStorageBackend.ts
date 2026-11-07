import { SchemaDecoder } from '@engine/validation';

import type { PlaygamaStorageApi } from './PlaygamaSdkContract';
import type { PlatformDataStorageBackend } from '../../types';

/** Adapts async Bridge storage to the engine's synchronous, bootstrapped cache. */
export class PlaygamaPlatformDataStorageBackend implements PlatformDataStorageBackend {
  private static readonly STORAGE_KEY = 'gamedevland.engine.storage.v1';
  private static readonly SNAPSHOT = SchemaDecoder.record();
  private static readonly VALUE = SchemaDecoder.string();

  private readonly data = new Map<string, string>();
  private loadPromise: Promise<void> | undefined;
  private persistChain: Promise<void> = Promise.resolve();
  private loaded = false;

  constructor(private readonly storage: PlaygamaStorageApi) {}

  async bootstrap(namespacePrefix: string): Promise<ReadonlyMap<string, string>> {
    this.loadPromise ??= this.loadSnapshot();
    await this.loadPromise;
    return new Map([...this.data].filter(([key]) => key.startsWith(namespacePrefix)));
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.requireLoaded();
    this.data.set(key, value);
    this.schedulePersist();
  }

  removeItem(key: string): void {
    this.requireLoaded();
    this.data.delete(key);
    this.schedulePersist();
  }

  private async loadSnapshot(): Promise<void> {
    const raw = await this.storage.get(PlaygamaPlatformDataStorageBackend.STORAGE_KEY);
    if (raw !== null && raw !== undefined) {
      const snapshot = SchemaDecoder.decode(raw, PlaygamaPlatformDataStorageBackend.SNAPSHOT, 'Playgama storage');
      // Validate the entire snapshot before publishing it to synchronous readers.
      const entries = Object.entries(snapshot).map(([key, value]) => [
        key,
        SchemaDecoder.decode(value, PlaygamaPlatformDataStorageBackend.VALUE, 'Playgama storage', `$.${key}`),
      ] as const);
      for (const [key, value] of entries) this.data.set(key, value);
    }
    this.loaded = true;
  }

  private schedulePersist(): void {
    const snapshot = Object.fromEntries(this.data);
    this.persistChain = this.persistChain
      .then(() => this.storage.set(PlaygamaPlatformDataStorageBackend.STORAGE_KEY, snapshot))
      .catch(() => {
        // Keep the in-memory save; a later mutation retries the latest snapshot.
      });
  }

  private requireLoaded(): void {
    if (!this.loaded) {
      throw new Error('Playgama storage must be bootstrapped before writing.');
    }
  }
}
