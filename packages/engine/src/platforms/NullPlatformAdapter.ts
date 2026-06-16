import type {
  PlatformAdapter,
  PlatformDataStorageBackend,
  PlatformRewardResult,
  PlatformRuntimeHooks,
} from './types';

/**
 * Safe no-op adapter used when no distribution platform SDK is configured.
 */
export class NullPlatformAdapter implements PlatformAdapter {
  readonly id = 'null';

  async init(): Promise<void> {}

  loadingFinished(): void {}

  gameplayStart(): void {}

  gameplayStop(): void {}

  happytime(): void {}

  getDataStorageBackend(): PlatformDataStorageBackend | null {
    return null;
  }

  getPreferredLocale(): string | null {
    return null;
  }

  setRuntimeHooks(_hooks: PlatformRuntimeHooks): void {}

  async prerollBreak(): Promise<void> {}

  async commercialBreak(): Promise<void> {}

  async rewardedBreak(): Promise<PlatformRewardResult> {
    return { success: false };
  }

  isInitialized(): boolean {
    return true;
  }

  dispose(): void {}
}
