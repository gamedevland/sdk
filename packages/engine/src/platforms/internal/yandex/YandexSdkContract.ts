export type YandexSdkEventName = 'game_api_pause' | 'game_api_resume';

export interface YandexPlayerDataObject {
  readonly [key: string]: unknown;
}

export interface YandexPlayerApi {
  getData(keys?: readonly string[]): Promise<YandexPlayerDataObject>;
  setData(data: YandexPlayerDataObject, flush?: boolean): Promise<unknown>;
}

export interface YandexLoadingApi {
  ready(): void;
}

export interface YandexGameplayApi {
  start(): void;
  stop(): void;
}

export interface YandexSdkFeaturesApi {
  readonly LoadingAPI?: YandexLoadingApi;
  readonly GameplayAPI?: YandexGameplayApi;
}

export interface YandexI18nEnvironmentApi {
  readonly lang?: string;
}

export interface YandexSdkEnvironmentApi {
  readonly i18n?: YandexI18nEnvironmentApi;
}

export interface YandexFullscreenAdCallbacks {
  readonly onOpen?: () => void;
  readonly onClose?: (wasShown: boolean) => void;
  readonly onError?: (error: unknown) => void;
}

export interface YandexRewardedAdCallbacks {
  readonly onOpen?: () => void;
  readonly onRewarded?: () => void;
  readonly onClose?: () => void;
  readonly onError?: (error: unknown) => void;
}

export interface YandexAdvApi {
  showFullscreenAdv(options?: { readonly callbacks?: YandexFullscreenAdCallbacks }): void;
  showRewardedVideo(options?: { readonly callbacks?: YandexRewardedAdCallbacks }): void;
}

export interface YandexSdkApi {
  readonly adv: YandexAdvApi;
  readonly environment?: YandexSdkEnvironmentApi;
  readonly features: YandexSdkFeaturesApi;
  getPlayer?(): Promise<YandexPlayerApi>;
  on(eventName: YandexSdkEventName, listener: () => void): void | (() => void);
  off(eventName: YandexSdkEventName, listener: () => void): void;
}

export interface YandexSdkLoader {
  init(): Promise<YandexSdkApi>;
}

interface YandexSdkWindow extends Window {
  YaGames?: YandexSdkLoader;
}

/**
 * Type-safe accessor for the global Yandex Games SDK loader.
 */
export class YandexSdkContract {
  static resolveLoader(): YandexSdkLoader | undefined {
    const yandexWindow = window as YandexSdkWindow;
    return typeof yandexWindow.YaGames !== 'undefined' ? yandexWindow.YaGames : undefined;
  }
}
