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
  private static readonly AD_REQUEST_TIMEOUT_MS = 90000;
  readonly id = 'crazygames';
  readonly muteAudioOnAdRequest = false;

  private initialized = false;
  private disposed = false;
  private initPromise: Promise<void> | undefined;
  private loadingStarted = false;
  private loadingFinishedSignaled = false;
  private dataStorageBackend: PlatformDataStorageBackend | null = null;
  private runtimeHooks: PlatformRuntimeHooks = Object.freeze({});
  private settingsListener: ((newSettings: CrazyGamesGameSettings) => void) | undefined;
  private sdk: CrazyGamesSdkApi | undefined;
  private pendingAd: ((success: boolean) => void) | undefined;
  private adPlaying = false;

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
    return this.getSdk()?.user?.systemInfo?.locale ?? null;
  }

  isAdvertisingAvailable(): boolean { return this.getSdk() !== undefined; }

  reportGameCompletedPercentage(percentage: number): void {
    try { this.getSdk()?.game.reportGameCompletedPercentage(percentage); } catch { /* Optional portal signal. */ }
  }

  setGameContext(context: Readonly<Record<string, string | number | boolean>>): void {
    try { this.getSdk()?.game.setGameContext(context); } catch { /* Optional portal signal. */ }
  }

  clearGameContext(): void {
    try { this.getSdk()?.game.clearGameContext(); } catch { /* Optional portal signal. */ }
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
    this.pendingAd?.(false);
    this.initPromise = undefined;
    this.dataStorageBackend = null;
    this.sdk = undefined;
    this.runtimeHooks = Object.freeze({});
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
    if (this.disposed) return;
    this.sdk = CrazyGamesSdkContract.isSupportedEnvironment(sdk.environment) ? sdk : undefined;
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
      if (this.loadingFinishedSignaled) initializedSdk.game.loadingStop();
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
      if (!this.disposed) this.applyAudioMuteSetting(newSettings);
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
    const sdk = this.sdk;
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
    this.runtimeHooks.onAudioMuteChanged?.(this.adPlaying || settings?.muteAudio === true);
  }

  private requestAd(type: CrazyGamesAdType): Promise<boolean> {
    const sdk = this.getSdk();
    if (!sdk || this.pendingAd) {
      return Promise.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      let settled = false;

      const finish = (success: boolean): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (timer !== undefined) clearTimeout(timer);
        this.pendingAd = undefined;
        this.adPlaying = false;
        this.applyAudioMuteSetting(sdk.game.settings);
        resolve(success && !this.disposed);
      };
      this.pendingAd = finish;
      const timer = setTimeout(() => finish(false), CrazyGamesPlatformAdapter.AD_REQUEST_TIMEOUT_MS);
      try {
        sdk.ad.requestAd(type, {
          adStarted: () => {
            if (settled || this.disposed) return;
            if (timer !== undefined) clearTimeout(timer);
            this.adPlaying = true;
            this.applyAudioMuteSetting(sdk.game.settings);
          },
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
    const sdk = this.sdk;
    if (!sdk) {
      return undefined;
    }
    return CrazyGamesSdkContract.isSupportedEnvironment(sdk.environment) ? sdk : undefined;
  }

  private getSdkAfterInit(): CrazyGamesSdkApi | undefined {
    if (this.disposed) {
      return undefined;
    }
    const sdk = this.sdk;
    if (!sdk) {
      return undefined;
    }
    return CrazyGamesSdkContract.isSupportedEnvironment(sdk.environment) ? sdk : undefined;
  }
}
