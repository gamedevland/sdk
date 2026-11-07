import type {
  PlaygamaAdEvent,
  PlaygamaAdKind,
  PlaygamaAdState,
  PlaygamaAdvertisementApi,
} from './PlaygamaSdkContract';

/** Owns one ad request, its completion events, watchdog and cancellation. */
export class PlaygamaAdBreak {
  private static readonly REQUEST_TIMEOUT_MS = 90000;

  private disposed = false;
  private pending: ((success: boolean) => void) | undefined;

  constructor(private readonly advertisement: PlaygamaAdvertisementApi) {}

  request(kind: PlaygamaAdKind): Promise<boolean> {
    const ads = this.advertisement;
    if (this.disposed || this.pending || this.isAdInProgress()) {
      return Promise.resolve(false);
    }
    if (kind === 'rewarded' ? !ads.isRewardedSupported : !ads.isInterstitialSupported) {
      return Promise.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
      const event: PlaygamaAdEvent = kind === 'rewarded'
        ? 'rewarded_state_changed' : 'interstitial_state_changed';
      let settled = false;
      let rewarded = false;
      const finish = (success: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.pending = undefined;
        try {
          ads.off(event, onStateChanged);
        } catch {
          // A failed SDK cleanup must still release the engine's ad break.
        }
        resolve(success && !this.disposed);
      };
      const onStateChanged = (state: PlaygamaAdState): void => {
        if (settled || this.disposed) return;
        switch (state) {
          case 'opened':
            // Do not resume the game over an ad that is actually playing.
            clearTimeout(timer);
            break;
          case 'rewarded':
            rewarded = true;
            break;
          case 'closed':
            // The reward notification can precede close; wait for both.
            finish(kind === 'rewarded' ? rewarded : true);
            break;
          case 'failed':
            finish(false);
            break;
        }
      };

      this.pending = finish;
      const timer = setTimeout(() => finish(false), PlaygamaAdBreak.REQUEST_TIMEOUT_MS);
      try {
        ads.on(event, onStateChanged);
        if (kind === 'rewarded') ads.showRewarded();
        else ads.showInterstitial();
      } catch {
        finish(false);
      }
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.pending?.(false);
  }

  private isAdInProgress(): boolean {
    const ads = this.advertisement;
    return ads.interstitialState === 'loading' || ads.interstitialState === 'opened'
      || ads.rewardedState === 'loading' || ads.rewardedState === 'opened'
      || ads.rewardedState === 'rewarded';
  }
}
