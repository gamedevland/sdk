import type { CrazyGamesSdkDataApi } from './CrazyGamesSdkContract';
import type { PlatformDataStorageBackend } from '../../types';

/**
 * Platform-owned storage bridge backed by CrazyGames Data Module.
 */
export class CrazyGamesPlatformDataStorageBackend implements PlatformDataStorageBackend {
  constructor(private readonly dataApi: CrazyGamesSdkDataApi) {}

  async bootstrap(_namespacePrefix: string): Promise<ReadonlyMap<string, string>> {
    return new Map<string, string>();
  }

  getItem(key: string): string | null {
    return this.dataApi.getItem(key);
  }

  setItem(key: string, value: string): void {
    this.dataApi.setItem(key, value);
  }

  removeItem(key: string): void {
    this.dataApi.removeItem(key);
  }
}
