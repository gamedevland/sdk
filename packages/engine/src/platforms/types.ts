/** Result of a rewarded ad break. */
export interface PlatformRewardResult {
  /** Whether the user completed watching the ad and earned the reward. */
  readonly success: boolean;
}

/** Optional key-value storage capability exposed by a distribution platform SDK. */
export interface PlatformDataStorageBackend {
  bootstrap(namespacePrefix: string): Promise<ReadonlyMap<string, string>>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Engine-owned hooks for ad break lifecycle. */
export interface PlatformAdBreakHooks {
  readonly onAdBreakStart?: () => void;
  readonly onAdBreakEnd?: () => void;
}

/** Engine-owned hooks for platform-originated runtime events. */
export interface PlatformRuntimeHooks {
  readonly onPauseRequested?: () => void;
  readonly onResumeRequested?: () => void;
  readonly onAudioMuteChanged?: (muted: boolean) => void;
}

/**
 * Universal contract for a game distribution platform SDK adapter.
 *
 * Lifecycle:
 * init() -> loadingFinished() -> gameplayStart/Stop() -> happytime() -> commercialBreak/rewardedBreak()
 */
export interface PlatformAdapter {
  /** False when the adapter mutes only after an ad playback callback. Defaults to true. */
  readonly muteAudioOnAdRequest?: boolean;
  /** Optional capabilities; unsupported adapters remain compatible. */
  isAdvertisingAvailable?(): boolean;
  reportGameCompletedPercentage?(percentage: number): void;
  setGameContext?(context: Readonly<Record<string, string | number | boolean>>): void;
  clearGameContext?(): void;
  /** Unique platform identifier (e.g. 'poki', 'crazygames', 'null'). */
  readonly id: string;

  /**
   * Initialize the platform SDK.
   * Must be idempotent and must not throw on SDK failures.
   */
  init(): Promise<void>;

  /** Signal that all game assets are loaded and the game is ready to play. */
  loadingFinished(): void;

  /** Signal the start of active gameplay (level start, unpause, etc.). */
  gameplayStart(): void;

  /** Signal the end of active gameplay (level end, pause, death, menu, etc.). */
  gameplayStop(): void;

  /** Signal a special celebratory moment to the distribution platform. */
  happytime(): void;

  /** Return an optional platform-owned storage backend for persistence integration. */
  getDataStorageBackend(): PlatformDataStorageBackend | null;

  /** Return a preferred locale hint reported by the platform SDK, if available. */
  getPreferredLocale(): string | null;

  /** Register engine-owned runtime hooks such as platform-originated pause/resume. */
  setRuntimeHooks(hooks: PlatformRuntimeHooks): void;

  /**
   * Request a startup pre-roll ad break.
   * Resolves when the ad finishes or is skipped.
   */
  prerollBreak(): Promise<void>;

  /**
   * Request a commercial ad break (interstitial).
   * Resolves when the ad finishes or is skipped.
   */
  commercialBreak(): Promise<void>;

  /**
   * Request a rewarded ad break (user-initiated).
   * Resolves with result indicating if reward was earned.
   */
  rewardedBreak(): Promise<PlatformRewardResult>;

  /** Whether the adapter has been initialized. */
  isInitialized(): boolean;

  /** Release platform resources and listeners. Idempotent. */
  dispose(): void;
}

/** Configuration for PlatformManager construction. */
export interface PlatformManagerOptions {
  /** The platform adapter instance. */
  readonly adapter: PlatformAdapter;
  /** Optional engine-owned ad break lifecycle hooks. */
  readonly adBreakHooks?: PlatformAdBreakHooks;
  /** Optional engine-owned runtime hooks. */
  readonly runtimeHooks?: PlatformRuntimeHooks;
}
