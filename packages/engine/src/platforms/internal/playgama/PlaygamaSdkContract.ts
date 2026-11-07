export type PlaygamaAdKind = 'interstitial' | 'rewarded';
export type PlaygamaAdState = 'loading' | 'opened' | 'closed' | 'rewarded' | 'failed';
export type PlaygamaAdEvent = 'interstitial_state_changed' | 'rewarded_state_changed';
export type PlaygamaRuntimeEvent = 'audio_state_changed' | 'pause_state_changed';
export type PlaygamaPlatformMessage =
  | 'game_ready'
  | 'gameplay_started'
  | 'gameplay_stopped'
  | 'player_got_achievement';

export interface PlaygamaPlatformApi {
  readonly language: string;
  readonly isAudioEnabled: boolean;
  readonly isPaused: boolean;
  sendMessage(message: PlaygamaPlatformMessage): Promise<unknown>;
  on(event: PlaygamaRuntimeEvent, listener: (state: boolean) => void): void;
  off(event: PlaygamaRuntimeEvent, listener: (state: boolean) => void): void;
}

export interface PlaygamaAdvertisementApi {
  readonly isInterstitialSupported: boolean;
  readonly isRewardedSupported: boolean;
  readonly interstitialState: PlaygamaAdState;
  readonly rewardedState: PlaygamaAdState;
  showInterstitial(): void;
  showRewarded(): void;
  on(event: PlaygamaAdEvent, listener: (state: PlaygamaAdState) => void): void;
  off(event: PlaygamaAdEvent, listener: (state: PlaygamaAdState) => void): void;
}

export interface PlaygamaStorageApi {
  get(key: string): Promise<unknown>;
  set(key: string, value: Readonly<Record<string, string>>): Promise<void>;
}

/** Narrow contract for the CDN-loaded Playgama Bridge v2 global. */
export interface PlaygamaSdkApi {
  initialize(): Promise<unknown>;
  readonly platform: PlaygamaPlatformApi;
  readonly advertisement: PlaygamaAdvertisementApi;
  readonly storage: PlaygamaStorageApi;
}

interface PlaygamaSdkWindow extends Window {
  readonly bridge?: PlaygamaSdkApi;
}

export class PlaygamaSdkContract {
  static resolve(): PlaygamaSdkApi | undefined {
    if (typeof window === 'undefined') return undefined;
    return (window as PlaygamaSdkWindow).bridge;
  }
}
