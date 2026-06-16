import { LocaleCatalog } from '../../../configs/common/LocaleCatalog';

import { YandexPlatformDataStorageBackend } from './YandexPlatformDataStorageBackend';
import { YandexSdkContract } from './YandexSdkContract';

import type {
  YandexPlayerApi,
  YandexSdkApi,
  YandexSdkEventName,
} from './YandexSdkContract';
import type {
  PlatformAdapter,
  PlatformDataStorageBackend,
  PlatformRewardResult,
  PlatformRuntimeHooks,
} from '../../types';

/**
 * Platform adapter for Yandex Games SDK.
 */
export class YandexPlatformAdapter implements PlatformAdapter {
  private static readonly GAME_API_PAUSE_EVENT: YandexSdkEventName = 'game_api_pause';
  private static readonly GAME_API_RESUME_EVENT: YandexSdkEventName = 'game_api_resume';
  private static readonly EMPTY_RUNTIME_HOOKS: PlatformRuntimeHooks = Object.freeze({});

  readonly id = 'yandex';

  private initialized = false;
  private disposed = false;
  private initPromise: Promise<void> | undefined;
  private sdk: YandexSdkApi | undefined;
  private dataStorageBackend: PlatformDataStorageBackend | null = null;
  private preferredLocale: string | null = null;
  private runtimeHooks: PlatformRuntimeHooks = YandexPlatformAdapter.EMPTY_RUNTIME_HOOKS;
  private subscribedToRuntimeEvents = false;

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
    const sdk = this.getSdk();
    if (!sdk) {
      return;
    }
    try {
      sdk.features.LoadingAPI?.ready();
    } catch {
      // Ignore SDK failures to keep startup alive.
    }
  }

  gameplayStart(): void {
    const sdk = this.getSdk();
    if (!sdk) {
      return;
    }
    try {
      sdk.features.GameplayAPI?.start();
    } catch {
      // Ignore SDK failures to keep gameplay flow alive.
    }
  }

  gameplayStop(): void {
    const sdk = this.getSdk();
    if (!sdk) {
      return;
    }
    try {
      sdk.features.GameplayAPI?.stop();
    } catch {
      // Ignore SDK failures to keep gameplay flow alive.
    }
  }

  happytime(): void {
    // Yandex Games SDK does not expose a celebratory signal.
  }

  getDataStorageBackend(): PlatformDataStorageBackend | null {
    return this.dataStorageBackend;
  }

  getPreferredLocale(): string | null {
    return this.preferredLocale;
  }

  setRuntimeHooks(hooks: PlatformRuntimeHooks): void {
    this.runtimeHooks = hooks;
  }

  async prerollBreak(): Promise<void> {
    // Pre-roll is not used on Yandex by engine policy.
  }

  async commercialBreak(): Promise<void> {
    const sdk = this.getSdk();
    if (!sdk) {
      return;
    }
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };
      try {
        sdk.adv.showFullscreenAdv({
          callbacks: {
            onClose: () => finish(),
            onError: () => finish(),
          },
        });
      } catch {
        finish();
      }
    });
  }

  async rewardedBreak(): Promise<PlatformRewardResult> {
    const sdk = this.getSdk();
    if (!sdk) {
      return { success: false };
    }
    const success = await new Promise<boolean>((resolve) => {
      let settled = false;
      let rewarded = false;
      const finish = (result: boolean): void => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(result);
      };
      try {
        sdk.adv.showRewardedVideo({
          callbacks: {
            onRewarded: () => {
              rewarded = true;
            },
            onClose: () => finish(rewarded),
            onError: () => finish(false),
          },
        });
      } catch {
        finish(false);
      }
    });
    return { success };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.unsubscribeFromRuntimeEvents();
    this.disposed = true;
    this.initPromise = undefined;
    this.sdk = undefined;
    this.dataStorageBackend = null;
    this.preferredLocale = null;
  }

  private async initializeSdk(): Promise<void> {
    const loader = YandexSdkContract.resolveLoader();
    if (!loader) {
      this.initialized = true;
      return;
    }
    try {
      this.sdk = await loader.init();
    } catch {
      this.initialized = true;
      return;
    }
    const sdk = this.sdk;
    if (!sdk) {
      this.initialized = true;
      return;
    }
    this.preferredLocale = this.resolvePreferredLocale(sdk);
    this.subscribeToRuntimeEvents(sdk);
    this.dataStorageBackend = await this.tryCreateDataStorageBackend(sdk);
    this.initialized = true;
  }

  private resolvePreferredLocale(sdk: YandexSdkApi): string | null {
    return LocaleCatalog.normalize(sdk.environment?.i18n?.lang);
  }

  private async tryCreateDataStorageBackend(
    sdk: YandexSdkApi,
  ): Promise<PlatformDataStorageBackend | null> {
    if (!sdk.getPlayer) {
      return null;
    }
    try {
      const player = await sdk.getPlayer();
      return this.createDataStorageBackend(player);
    } catch {
      return null;
    }
  }

  private createDataStorageBackend(
    player: YandexPlayerApi,
  ): PlatformDataStorageBackend {
    return new YandexPlatformDataStorageBackend(player);
  }

  private subscribeToRuntimeEvents(sdk: YandexSdkApi): void {
    if (this.subscribedToRuntimeEvents) {
      return;
    }
    try {
      sdk.on(YandexPlatformAdapter.GAME_API_PAUSE_EVENT, this.handlePauseRequested);
      sdk.on(YandexPlatformAdapter.GAME_API_RESUME_EVENT, this.handleResumeRequested);
      this.subscribedToRuntimeEvents = true;
    } catch {
      // Ignore SDK failures to keep startup alive.
    }
  }

  private unsubscribeFromRuntimeEvents(): void {
    if (!this.subscribedToRuntimeEvents) {
      return;
    }
    const sdk = this.sdk;
    this.subscribedToRuntimeEvents = false;
    if (!sdk) {
      return;
    }
    try {
      sdk.off(YandexPlatformAdapter.GAME_API_PAUSE_EVENT, this.handlePauseRequested);
      sdk.off(YandexPlatformAdapter.GAME_API_RESUME_EVENT, this.handleResumeRequested);
    } catch {
      // Ignore SDK failures during dispose.
    }
  }

  private getSdk(): YandexSdkApi | undefined {
    if (!this.initialized || this.disposed) {
      return undefined;
    }
    return this.sdk;
  }

  private readonly handlePauseRequested = (): void => {
    if (this.disposed) {
      return;
    }
    this.runtimeHooks.onPauseRequested?.();
  };

  private readonly handleResumeRequested = (): void => {
    if (this.disposed) {
      return;
    }
    this.runtimeHooks.onResumeRequested?.();
  };
}
