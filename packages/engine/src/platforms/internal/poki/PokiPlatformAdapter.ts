import { PokiSdkContract } from './PokiSdkContract';

import type { PokiSdkApi } from './PokiSdkContract';
import type {
  PlatformAdapter,
  PlatformDataStorageBackend,
  PlatformRewardResult,
  PlatformRuntimeHooks,
} from '../../types';

/**
 * Platform adapter for Poki HTML5 SDK.
 */
export class PokiPlatformAdapter implements PlatformAdapter {
  readonly id = 'poki';

  private initialized = false;
  private disposed = false;
  private initPromise: Promise<void> | undefined;

  async init(): Promise<void> {
    if (this.initialized || this.disposed) {
      return;
    }
    if (this.initPromise) {
      await this.initPromise;
      return;
    }
    this.initPromise = this.initializeSdk();
    await this.initPromise;
    this.initPromise = undefined;
  }

  loadingFinished(): void {
    this.getSdk()?.gameLoadingFinished();
  }

  gameplayStart(): void {
    this.getSdk()?.gameplayStart();
  }

  gameplayStop(): void {
    this.getSdk()?.gameplayStop();
  }

  happytime(): void {
    // Poki SDK does not expose a celebratory signal.
  }

  getDataStorageBackend(): PlatformDataStorageBackend | null {
    return null;
  }

  getPreferredLocale(): string | null {
    return null;
  }

  setRuntimeHooks(_hooks: PlatformRuntimeHooks): void {
    // Poki SDK does not emit platform pause/resume events via this boundary.
  }

  async prerollBreak(): Promise<void> {
    // Pre-roll is not used on Poki by engine policy.
  }

  async commercialBreak(): Promise<void> {
    const sdk = this.getSdk();
    if (!sdk) {
      return;
    }
    try {
      await sdk.commercialBreak();
    } catch {
      // Ignore SDK failures to keep gameplay flow alive.
    }
  }

  async rewardedBreak(): Promise<PlatformRewardResult> {
    const sdk = this.getSdk();
    if (!sdk) {
      return { success: false };
    }
    try {
      const success = await sdk.rewardedBreak();
      return { success };
    } catch {
      return { success: false };
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.initPromise = undefined;
  }

  private async initializeSdk(): Promise<void> {
    const sdk = PokiSdkContract.resolve();
    if (!sdk) {
      this.initialized = true;
      return;
    }
    try {
      await sdk.init();
    } catch {
      // SDK init errors should not crash the runtime.
    }
    this.initialized = true;
  }

  private getSdk(): PokiSdkApi | undefined {
    if (!this.initialized || this.disposed) {
      return undefined;
    }
    return PokiSdkContract.resolve();
  }
}
