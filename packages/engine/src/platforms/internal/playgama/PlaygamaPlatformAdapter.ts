import { PlaygamaAdBreak } from './PlaygamaAdBreak';
import { PlaygamaPlatformDataStorageBackend } from './PlaygamaPlatformDataStorageBackend';
import { PlaygamaSdkContract } from './PlaygamaSdkContract';

import type { PlaygamaPlatformMessage, PlaygamaSdkApi } from './PlaygamaSdkContract';
import type {
  PlatformAdapter,
  PlatformDataStorageBackend,
  PlatformRewardResult,
  PlatformRuntimeHooks,
} from '../../types';

/** Platform adapter for Playgama Bridge v2, including its partner portals. */
export class PlaygamaPlatformAdapter implements PlatformAdapter {
  readonly id = 'playgama';
  readonly muteAudioOnAdRequest = false;

  private initialized = false;
  private disposed = false;
  private initPromise: Promise<void> | undefined;
  private sdk: PlaygamaSdkApi | undefined;
  private dataStorageBackend: PlatformDataStorageBackend | null = null;
  private adBreak: PlaygamaAdBreak | undefined;
  private runtimeHooks: PlatformRuntimeHooks = Object.freeze({});
  private loadingFinishedSignaled = false;
  private gameReadySent = false;

  private readonly onAudioStateChanged = (enabled: boolean): void => {
    if (!this.disposed) this.runtimeHooks.onAudioMuteChanged?.(!enabled);
  };

  private readonly onPauseStateChanged = (paused: boolean): void => {
    if (this.disposed) return;
    if (paused) this.runtimeHooks.onPauseRequested?.();
    else this.runtimeHooks.onResumeRequested?.();
  };

  async init(): Promise<void> {
    if (this.initialized || this.disposed) return;
    this.initPromise ??= this.initializeSdk();
    await this.initPromise;
  }

  loadingFinished(): void {
    this.loadingFinishedSignaled = true;
    this.sendGameReady();
  }

  gameplayStart(): void {
    this.sendMessage('gameplay_started');
  }

  gameplayStop(): void {
    this.sendMessage('gameplay_stopped');
  }

  happytime(): void {
    this.sendMessage('player_got_achievement');
  }

  getDataStorageBackend(): PlatformDataStorageBackend | null {
    return this.dataStorageBackend;
  }

  getPreferredLocale(): string | null {
    return this.sdk?.platform.language ?? null;
  }

  isAdvertisingAvailable(): boolean {
    if (!this.initialized || this.disposed) return false;
    const ads = this.sdk?.advertisement;
    return ads !== undefined && (ads.isInterstitialSupported || ads.isRewardedSupported);
  }

  setRuntimeHooks(hooks: PlatformRuntimeHooks): void {
    this.runtimeHooks = hooks;
    this.applyRuntimeState();
  }

  async prerollBreak(): Promise<void> {
    // Startup ads are left to the host; game ads belong at natural gameplay breaks.
  }

  async commercialBreak(): Promise<void> {
    if (!this.initialized || this.disposed) return;
    await this.adBreak?.request('interstitial');
  }

  async rewardedBreak(): Promise<PlatformRewardResult> {
    if (!this.initialized || this.disposed) return { success: false };
    return { success: await this.adBreak?.request('rewarded') ?? false };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.adBreak?.dispose();
    this.detachRuntimeListeners();
    this.sdk = undefined;
    this.adBreak = undefined;
    this.dataStorageBackend = null;
    this.runtimeHooks = Object.freeze({});
  }

  private async initializeSdk(): Promise<void> {
    try {
      const sdk = PlaygamaSdkContract.resolve();
      if (!sdk) return;
      await sdk.initialize();
      if (this.disposed) return;
      this.sdk = sdk;
      this.adBreak = new PlaygamaAdBreak(sdk.advertisement);
      sdk.platform.on('audio_state_changed', this.onAudioStateChanged);
      sdk.platform.on('pause_state_changed', this.onPauseStateChanged);
      this.applyRuntimeState();

      const storage = new PlaygamaPlatformDataStorageBackend(sdk.storage);
      try {
        // Load before locale/preferences and persistence boot tasks read synchronously.
        await storage.bootstrap('');
        if (!this.disposed) this.dataStorageBackend = storage;
      } catch {
        // Storage failure must not disable platform lifecycle and advertisements.
      }
    } catch {
      this.detachRuntimeListeners();
      this.sdk = undefined;
      this.adBreak?.dispose();
      this.adBreak = undefined;
    } finally {
      if (!this.disposed) {
        this.initialized = true;
        this.sendGameReady();
      }
    }
  }

  private applyRuntimeState(): void {
    const platform = this.sdk?.platform;
    if (!platform || this.disposed) return;
    this.onAudioStateChanged(platform.isAudioEnabled);
    this.onPauseStateChanged(platform.isPaused);
  }

  private detachRuntimeListeners(): void {
    const platform = this.sdk?.platform;
    if (!platform) return;
    try {
      platform.off('audio_state_changed', this.onAudioStateChanged);
    } catch {
      // Continue cleanup even when a host API fails.
    }
    try {
      platform.off('pause_state_changed', this.onPauseStateChanged);
    } catch {
      // Continue cleanup even when a host API fails.
    }
  }

  private sendGameReady(): void {
    if (!this.initialized || !this.sdk || !this.loadingFinishedSignaled || this.gameReadySent) return;
    this.gameReadySent = true;
    this.sendMessage('game_ready');
  }

  private sendMessage(message: PlaygamaPlatformMessage): void {
    if (!this.sdk || !this.initialized || this.disposed) return;
    try {
      void this.sdk.platform.sendMessage(message).catch(() => {
        // Unsupported host messages must not interrupt gameplay.
      });
    } catch {
      // Ignore synchronous SDK failures as well as rejected messages.
    }
  }
}
