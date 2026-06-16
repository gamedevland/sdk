import { GameDistributionBootstrapContract } from '../../shared/GameDistributionBootstrapContract';

export type GameDistributionSdkEventName =
  | 'SDK_READY'
  | 'SDK_ERROR'
  | 'SDK_GAME_START'
  | 'SDK_GAME_PAUSE'
  | 'SDK_GDPR_TRACKING'
  | 'SDK_GDPR_TARGETING'
  | 'SDK_GDPR_THIRD_PARTY'
  | 'SDK_REWARDED_WATCH_COMPLETE'
  | (string & {});

export interface GameDistributionSdkEvent {
  readonly name: GameDistributionSdkEventName;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface GameDistributionSdkOptions {
  readonly gameId: string;
  readonly onEvent: (event: GameDistributionSdkEvent) => void;
}

export interface GameDistributionAdTypeApi {
  readonly Rewarded?: string;
}

export interface GameDistributionSdkApi {
  readonly AdType?: GameDistributionAdTypeApi;
  showAd(adType?: string): Promise<unknown> | void;
  openConsole?(): void;
}

interface GameDistributionBridgeState {
  readonly queue: GameDistributionSdkEvent[];
  readonly listeners: Set<(event: GameDistributionSdkEvent) => void>;
}

interface GameDistributionWindow extends Window {
  GD_OPTIONS?: GameDistributionSdkOptions;
  gdsdk?: GameDistributionSdkApi;
  __ENGINE_GAMEDISTRIBUTION_BRIDGE__?: GameDistributionBridgeState;
}

/**
 * Type-safe access layer for the GameDistribution SDK globals and event bridge.
 */
export class GameDistributionSdkContract {
  static resolveSdk(): GameDistributionSdkApi | undefined {
    return (window as GameDistributionWindow).gdsdk;
  }

  static subscribe(listener: (event: GameDistributionSdkEvent) => void): () => void {
    const bridge = GameDistributionSdkContract.getOrCreateBridge();
    bridge.listeners.add(listener);
    for (const event of bridge.queue) {
      listener(event);
    }
    bridge.queue.length = 0;
    return () => {
      bridge.listeners.delete(listener);
    };
  }

  private static getOrCreateBridge(): GameDistributionBridgeState {
    const targetWindow = window as GameDistributionWindow;
    const existingBridge =
      targetWindow[GameDistributionBootstrapContract.BRIDGE_KEY];
    if (existingBridge) {
      return existingBridge;
    }
    const createdBridge: GameDistributionBridgeState = {
      queue: [],
      listeners: new Set(),
    };
    targetWindow[GameDistributionBootstrapContract.BRIDGE_KEY] = createdBridge;
    return createdBridge;
  }
}
