/** Typed contract for the PokiSDK global namespace. */
export interface PokiSdkApi {
  init(): Promise<void>;
  gameLoadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  commercialBreak(onStart?: () => void): Promise<void>;
  rewardedBreak(onStart?: () => void): Promise<boolean>;
  shareableURL(params: Record<string, string>): Promise<string>;
  getURLParam(key: string): string;
  setDebug(enabled: boolean): void;
}

/** Window augmentation for PokiSDK global. */
interface PokiSdkWindow extends Window {
  PokiSDK?: PokiSdkApi;
}

/**
 * Type-safe accessor for the global PokiSDK object loaded via script tag.
 */
export class PokiSdkContract {
  static isAvailable(): boolean {
    return typeof (window as PokiSdkWindow).PokiSDK !== 'undefined';
  }

  static resolve(): PokiSdkApi | undefined {
    const pokiWindow = window as PokiSdkWindow;
    return typeof pokiWindow.PokiSDK !== 'undefined' ? pokiWindow.PokiSDK : undefined;
  }
}
