import type {
  PlatformAdapter,
  PlatformDataStorageBackend,
  PlatformRewardResult,
  PlatformRuntimeHooks,
} from '../../types';

/**
 * Platform adapter for standalone web runtime without external SDK integration.
 */
export class WebPlatformAdapter implements PlatformAdapter {
  readonly id = 'web';

  async init(): Promise<void> {
    // No-op for standalone web platform.
  }

  loadingFinished(): void {
    // No-op for standalone web platform.
  }

  gameplayStart(): void {
    // No-op for standalone web platform.
  }

  gameplayStop(): void {
    // No-op for standalone web platform.
  }

  happytime(): void {
    // No-op for standalone web platform.
  }

  getDataStorageBackend(): PlatformDataStorageBackend | null {
    return null;
  }

  getPreferredLocale(): string | null {
    return null;
  }

  setRuntimeHooks(_hooks: PlatformRuntimeHooks): void {
    // Standalone web runtime has no platform-originated events.
  }

  async prerollBreak(): Promise<void> {
    // No-op for standalone web platform.
  }

  async commercialBreak(): Promise<void> {
    // No-op for standalone web platform.
  }

  async rewardedBreak(): Promise<PlatformRewardResult> {
    return { success: true };
  }

  isInitialized(): boolean {
    return true;
  }

  dispose(): void {
    // No-op for standalone web platform.
  }
}
