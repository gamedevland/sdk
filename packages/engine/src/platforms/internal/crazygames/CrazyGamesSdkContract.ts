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
  reportGameCompletedPercentage(percentage: number): void;
  setGameContext(context: Readonly<Record<string, string | number | boolean>>): void;
  clearGameContext(): void;
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
  readonly user?: { readonly systemInfo?: { readonly locale?: string } };
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
    return this.resolve() !== undefined;
  }

  static resolve(): CrazyGamesSdkApi | undefined {
    if (typeof window === 'undefined') return undefined;
    const crazyGamesWindow = window as CrazyGamesSdkWindow;
    const sdk = crazyGamesWindow.CrazyGames?.SDK;
    return typeof sdk !== 'undefined' ? sdk : undefined;
  }

  static isSupportedEnvironment(environment: CrazyGamesSdkEnvironment): boolean {
    return environment === 'local' || environment === 'crazygames';
  }
}
