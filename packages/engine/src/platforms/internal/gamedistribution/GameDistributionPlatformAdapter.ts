import { GameDistributionSdkContract } from './GameDistributionSdkContract';

import type { GameDistributionSdkEvent } from './GameDistributionSdkContract';
import type {
  PlatformAdapter,
  PlatformDataStorageBackend,
  PlatformRewardResult,
  PlatformRuntimeHooks,
} from '../../types';

type GameDistributionAdRequestKind = 'commercial' | 'rewarded';

interface PendingGameDistributionAdRequest {
  readonly kind: GameDistributionAdRequestKind;
  timeoutId: number | undefined;
  rewardGranted: boolean;
  settled: boolean;
  readonly resolve: (result: PlatformRewardResult) => void;
}

/**
 * Platform adapter for the GameDistribution HTML5 SDK.
 */
export class GameDistributionPlatformAdapter implements PlatformAdapter {
  private static readonly AD_REQUEST_TIMEOUT_MS = 15000;
  private static readonly EMPTY_RUNTIME_HOOKS: PlatformRuntimeHooks = Object.freeze({});
  private static readonly SDK_GAME_PAUSE_EVENT = 'SDK_GAME_PAUSE';
  private static readonly SDK_GAME_START_EVENT = 'SDK_GAME_START';
  private static readonly SDK_ERROR_EVENT = 'SDK_ERROR';
  private static readonly SDK_REWARDED_WATCH_COMPLETE_EVENT = 'SDK_REWARDED_WATCH_COMPLETE';
  private static readonly REWARDED_AD_TYPE = 'rewarded';

  readonly id = 'gamedistribution';

  private initialized = false;
  private adPaused = false;
  private disposed = false;
  private runtimeHooks: PlatformRuntimeHooks = GameDistributionPlatformAdapter.EMPTY_RUNTIME_HOOKS;
  private unsubscribeBridge: (() => void) | undefined;
  private pendingRequest: PendingGameDistributionAdRequest | undefined;

  async init(): Promise<void> {
    if (this.initialized || this.disposed) {
      return;
    }
    this.unsubscribeBridge = GameDistributionSdkContract.subscribe(this.handleSdkEvent);
    this.initialized = true;
  }

  loadingFinished(): void {
    // GameDistribution SDK does not expose a loading-finished signal.
  }

  gameplayStart(): void {
    // GameDistribution SDK does not expose gameplay lifecycle methods.
  }

  gameplayStop(): void {
    // GameDistribution SDK does not expose gameplay lifecycle methods.
  }

  happytime(): void {
    // GameDistribution SDK does not expose a celebratory signal.
  }

  getDataStorageBackend(): PlatformDataStorageBackend | null {
    return null;
  }

  getPreferredLocale(): string | null {
    return null;
  }

  setRuntimeHooks(hooks: PlatformRuntimeHooks): void {
    this.runtimeHooks = hooks;
  }

  async prerollBreak(): Promise<void> {
    const result = await this.requestAd('commercial');
    void result;
  }

  async commercialBreak(): Promise<void> {
    const result = await this.requestAd('commercial');
    void result;
  }

  async rewardedBreak(): Promise<PlatformRewardResult> {
    return this.requestAd('rewarded');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.unsubscribeBridge?.();
    this.unsubscribeBridge = undefined;
    this.runtimeHooks = GameDistributionPlatformAdapter.EMPTY_RUNTIME_HOOKS;
    this.finishPendingRequest(false);
  }

  private requestAd(kind: GameDistributionAdRequestKind): Promise<PlatformRewardResult> {
    if (!this.initialized || this.disposed) {
      return Promise.resolve({ success: false });
    }

    const sdk = GameDistributionSdkContract.resolveSdk();
    if (!sdk || typeof sdk.showAd !== 'function' || this.pendingRequest) {
      return Promise.resolve({ success: false });
    }

    return new Promise<PlatformRewardResult>((resolve) => {
      const timeoutId = window.setTimeout(() => {
        if (this.pendingRequest === request) this.finishPendingRequest(false);
      }, GameDistributionPlatformAdapter.AD_REQUEST_TIMEOUT_MS);

      const request: PendingGameDistributionAdRequest = {
        kind,
        timeoutId,
        rewardGranted: false,
        settled: false,
        resolve,
      };
      this.pendingRequest = request;

      let showAdResult: Promise<unknown> | void;
      try {
        showAdResult = kind === 'rewarded' ? sdk.showAd(this.resolveRewardedAdType(sdk)) : sdk.showAd();
      } catch {
        this.finishPendingRequest(false);
        return;
      }

      if (showAdResult instanceof Promise) {
        void showAdResult.then(
          () => {
            if (this.pendingRequest === request) this.finishPendingRequest(this.getPendingRewardSuccess());
          },
          () => {
            if (this.pendingRequest === request) this.finishPendingRequest(false);
          },
        );
      }
    });
  }

  private resolveRewardedAdType(sdk: { readonly AdType?: { readonly Rewarded?: string } }): string {
    return sdk.AdType?.Rewarded ?? GameDistributionPlatformAdapter.REWARDED_AD_TYPE;
  }

  private getPendingRewardSuccess(): boolean {
    const pendingRequest = this.pendingRequest;
    if (!pendingRequest) {
      return false;
    }
    return pendingRequest.kind === 'rewarded' && pendingRequest.rewardGranted;
  }

  private finishPendingRequest(success: boolean): void {
    const pendingRequest = this.pendingRequest;
    if (!pendingRequest || pendingRequest.settled) {
      return;
    }
    this.clearRequestTimeout(pendingRequest);
    pendingRequest.settled = true;
    this.pendingRequest = undefined;
    this.resumeRuntime();
    pendingRequest.resolve({ success });
  }

  private clearRequestTimeout(request: PendingGameDistributionAdRequest): void {
    if (request.timeoutId === undefined) return;
    window.clearTimeout(request.timeoutId);
    request.timeoutId = undefined;
  }

  private resumeRuntime(): void {
    if (!this.adPaused) return;
    this.adPaused = false;
    this.runtimeHooks.onResumeRequested?.();
  }

  private readonly handleSdkEvent = (event: GameDistributionSdkEvent): void => {
    if (this.disposed) {
      return;
    }

    switch (event.name) {
      case GameDistributionPlatformAdapter.SDK_GAME_PAUSE_EVENT:
        // The watchdog bounds loading only. A legitimate video may exceed fifteen seconds.
        if (this.pendingRequest) this.clearRequestTimeout(this.pendingRequest);
        this.adPaused = true;
        this.runtimeHooks.onPauseRequested?.();
        break;
      case GameDistributionPlatformAdapter.SDK_GAME_START_EVENT:
        this.adPaused = false;
        this.runtimeHooks.onResumeRequested?.();
        this.finishPendingRequest(this.getPendingRewardSuccess());
        break;
      case GameDistributionPlatformAdapter.SDK_REWARDED_WATCH_COMPLETE_EVENT: {
        const pendingRequest = this.pendingRequest;
        if (pendingRequest && pendingRequest.kind === 'rewarded') {
          pendingRequest.rewardGranted = true;
        }
        break;
      }
      case GameDistributionPlatformAdapter.SDK_ERROR_EVENT:
      case 'AD_ERROR':
        this.resumeRuntime();
        this.finishPendingRequest(false);
        break;
      default:
        break;
    }
  };
}
