export type CrazyGamesSdkEnvironment = 'local' | 'crazygames' | 'disabled' | (string & {});

export type CrazyGamesAdType = 'midgame' | 'rewarded';

export interface CrazyGamesGameSettings {
  readonly disableChat?: boolean;
  readonly muteAudio?: boolean;
}

export interface CrazyGamesAdErrorData {
  readonly reason?: string;
  readonly message?: string;
}

export interface CrazyGamesAdCallbacks {
  readonly adStarted?: () => void;
  readonly adFinished?: () => void;
  readonly adError?: (error: unknown, errorData?: CrazyGamesAdErrorData) => void;
}

export interface CrazyGamesSdkGameApi {
  readonly settings: CrazyGamesGameSettings;
  loadingStart(): void;
  loadingStop(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  happytime(): void;
  addSettingsChangeListener(listener: (newSettings: CrazyGamesGameSettings) => void): void;
  removeSettingsChangeListener(listener: (newSettings: CrazyGamesGameSettings) => void): void;
}

export interface CrazyGamesSdkAdApi {
  requestAd(type: CrazyGamesAdType, callbacks: CrazyGamesAdCallbacks): void;
}

export interface CrazyGamesSdkDataApi {
  clear(): void;
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export interface CrazyGamesSdkApi {
  init(): Promise<void>;
  readonly environment: CrazyGamesSdkEnvironment;
  readonly game: CrazyGamesSdkGameApi;
  readonly ad: CrazyGamesSdkAdApi;
  readonly data?: CrazyGamesSdkDataApi;
}

interface CrazyGamesSdkWindow extends Window {
  CrazyGames?: {
    readonly SDK?: CrazyGamesSdkApi;
  };
}

/**
 * Type-safe accessor for the global CrazyGames SDK loaded via script tag.
 */
export class CrazyGamesSdkContract {
  static isAvailable(): boolean {
    return typeof (window as CrazyGamesSdkWindow).CrazyGames?.SDK !== 'undefined';
  }

  static resolve(): CrazyGamesSdkApi | undefined {
    const crazyGamesWindow = window as CrazyGamesSdkWindow;
    const sdk = crazyGamesWindow.CrazyGames?.SDK;
    return typeof sdk !== 'undefined' ? sdk : undefined;
  }

  static isSupportedEnvironment(environment: CrazyGamesSdkEnvironment): boolean {
    return environment === 'local' || environment === 'crazygames';
  }
}
