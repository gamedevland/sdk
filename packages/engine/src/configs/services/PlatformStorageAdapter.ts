import { LocalStorageAdapter } from './LocalStorageAdapter';

import type { IStorageAdapter } from '../core/types';
import type { PlatformManager } from '@engine/platforms';

/** Uses platform-owned data exclusively when available; otherwise uses browser storage. */
export class PlatformStorageAdapter implements IStorageAdapter {
  private browser: IStorageAdapter | undefined;

  constructor(private readonly platform: PlatformManager) {}

  getItem(key: string): string | null { return this.backend.getItem(key); }
  setItem(key: string, value: string): void { this.backend.setItem(key, value); }
  removeItem(key: string): void { this.backend.removeItem(key); }

  private get backend(): IStorageAdapter {
    const platform = this.platform.getDataStorageBackend();
    if (platform) return platform;
    this.browser ??= new LocalStorageAdapter();
    return this.browser;
  }
}
