import { PersistentStorageCoordinator } from './PersistentStorageCoordinator';

import type { IStorageAdapter } from '../core/types';

export class PersistentStorageAdapter implements IStorageAdapter {
  private readonly coordinator = PersistentStorageCoordinator.shared();

  getItem(key: string): string | null {
    return this.coordinator.getItem(key);
  }

  setItem(key: string, value: string): void {
    this.coordinator.setItem(key, value);
  }

  removeItem(key: string): void {
    this.coordinator.removeItem(key);
  }
}
