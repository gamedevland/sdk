import { CrazyGamesPlatformDataStorageBackend } from './CrazyGamesPlatformDataStorageBackend';
import { CrazyGamesSdkContract } from './CrazyGamesSdkContract';

import type {
  CrazyGamesAdType,
  CrazyGamesGameSettings,
  CrazyGamesSdkApi,
} from './CrazyGamesSdkContract';
import type {
  PlatformAdapter,
  PlatformDataStorageBackend,
  PlatformRewardResult,
  PlatformRuntimeHooks,
} from '../../types';

/**
 * Platform adapter for CrazyGames HTML5 v3 SDK.
 */
export class CrazyGamesPlatformAdapter implements PlatformAdapter {
  readonly id = 'crazygames';

  private initialized = false;
  private disposed = false;
  private initPromise: Promise<void> | undefined;
  private loadingStarted = false;
  private loadingFinishedSignaled = false;
  private dataStorageBackend: PlatformDataStorageBackend | null = null;
  private runtimeHooks: PlatformRuntimeHooks = Object.freeze({});
  private settingsListener: ((newSettings: CrazyGamesGameSettings) => void) | undefined;

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
    if (this.loadingFinishedSignaled) {
      return;
    }
    this.loadingFinishedSignaled = true;
    if (!this.loadingStarted) {
      return;
    }
    const sdk = this.getSdk();
    if (!sdk) {
      return;
    }
    try {
      sdk.game.loadingStop();
    } catch {
      // Ignore SDK failures to keep gameplay flow alive.
    }
  }

  gameplayStart(): void {
    const sdk = this.getSdk();
    if (!sdk) {
      return;
    }
    try {
      sdk.game.gameplayStart();
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
      sdk.game.gameplayStop();
    } catch {
      // Ignore SDK failures to keep gameplay flow alive.
    }
  }

  happytime(): void {
    const sdk = this.getSdk();
    if (!sdk) {
      return;
    }
    try {
      sdk.game.happytime();
    } catch {
      // Ignore SDK failures to keep gameplay flow alive.
    }
  }

  getDataStorageBackend(): PlatformDataStorageBackend | null {
    return this.dataStorageBackend;
  }

  getPreferredLocale(): string | null {
    return null;
  }

  setRuntimeHooks(hooks: PlatformRuntimeHooks): void {
    this.runtimeHooks = hooks;
    const sdk = this.getSdkAfterInit();
    if (!sdk) {
      return;
    }
    this.applyAudioMuteSetting(sdk.game.settings);
  }

  async prerollBreak(): Promise<void> {
    // Pre-roll is not used on CrazyGames by engine policy.
  }

  async commercialBreak(): Promise<void> {
    await this.requestAd('midgame');
  }

  async rewardedBreak(): Promise<PlatformRewardResult> {
    const success = await this.requestAd('rewarded');
    return { success };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.detachSettingsListener();
    this.disposed = true;
    this.initPromise = undefined;
    this.dataStorageBackend = null;
  }

  private async initializeSdk(): Promise<void> {
    const sdk = CrazyGamesSdkContract.resolve();
    if (!sdk) {
      this.initialized = true;
      return;
    }
    try {
      await sdk.init();
    } catch {
      this.initialized = true;
      return;
    }
    const initializedSdk = this.getSdkAfterInit();
    if (!initializedSdk) {
      this.initialized = true;
      return;
    }
    this.dataStorageBackend = this.createDataStorageBackend(initializedSdk);
    this.attachSettingsListener(initializedSdk);
    this.applyAudioMuteSetting(initializedSdk.game.settings);
    try {
      initializedSdk.game.loadingStart();
      this.loadingStarted = true;
    } catch {
      // Ignore SDK failures to keep startup alive.
    }
    this.initialized = true;
  }

  private createDataStorageBackend(sdk: CrazyGamesSdkApi): PlatformDataStorageBackend | null {
    const dataApi = sdk.data;
    if (!dataApi) {
      return null;
    }
    return new CrazyGamesPlatformDataStorageBackend(dataApi);
  }

  private attachSettingsListener(sdk: CrazyGamesSdkApi): void {
    if (this.settingsListener) {
      return;
    }
    const listener = (newSettings: CrazyGamesGameSettings): void => {
      this.applyAudioMuteSetting(newSettings);
    };
    try {
      sdk.game.addSettingsChangeListener(listener);
      this.settingsListener = listener;
    } catch {
      // Ignore SDK failures to keep gameplay flow alive.
    }
  }

  private detachSettingsListener(): void {
    const listener = this.settingsListener;
    if (!listener) {
      return;
    }
    const sdk = CrazyGamesSdkContract.resolve();
    this.settingsListener = undefined;
    if (!sdk || !CrazyGamesSdkContract.isSupportedEnvironment(sdk.environment)) {
      return;
    }
    try {
      sdk.game.removeSettingsChangeListener(listener);
    } catch {
      // Ignore SDK failures to keep gameplay flow alive.
    }
  }

  private applyAudioMuteSetting(settings: CrazyGamesGameSettings | undefined): void {
    this.runtimeHooks.onAudioMuteChanged?.(settings?.muteAudio === true);
  }

  private requestAd(type: CrazyGamesAdType): Promise<boolean> {
    const sdk = this.getSdk();
    if (!sdk) {
      return Promise.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (success: boolean): void => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(success);
      };
      try {
        sdk.ad.requestAd(type, {
          adFinished: () => finish(true),
          adError: () => finish(false),
        });
      } catch {
        finish(false);
      }
    });
  }

  private getSdk(): CrazyGamesSdkApi | undefined {
    if (!this.initialized || this.disposed) {
      return undefined;
    }
    const sdk = CrazyGamesSdkContract.resolve();
    if (!sdk) {
      return undefined;
    }
    return CrazyGamesSdkContract.isSupportedEnvironment(sdk.environment) ? sdk : undefined;
  }

  private getSdkAfterInit(): CrazyGamesSdkApi | undefined {
    if (this.disposed) {
      return undefined;
    }
    const sdk = CrazyGamesSdkContract.resolve();
    if (!sdk) {
      return undefined;
    }
    return CrazyGamesSdkContract.isSupportedEnvironment(sdk.environment) ? sdk : undefined;
  }
}
