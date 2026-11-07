import { PlatformAdapterResolver } from '@engine/platforms/internal/PlatformAdapterResolver';

import type {
  PlatformAdBreakHooks,
  PlatformAdapter,
  PlatformDataStorageBackend,
  PlatformManagerOptions,
  PlatformRewardResult,
  PlatformRuntimeHooks,
} from './types';

/**
 * Public facade that orchestrates platform SDK lifecycle and ad-break hooks.
 */
export class PlatformManager {
  private static readonly EMPTY_AD_BREAK_HOOKS: PlatformAdBreakHooks = Object.freeze({});
  private static readonly EMPTY_RUNTIME_HOOKS: PlatformRuntimeHooks = Object.freeze({});

  private readonly adapter: PlatformAdapter;
  private adBreakHooks: PlatformAdBreakHooks;
  private initPromise: Promise<void> | undefined;
  private initialized = false;
  private gameplayRunning = false;

  constructor(options: PlatformManagerOptions) {
    this.adapter = options.adapter;
    this.adBreakHooks = options.adBreakHooks ?? PlatformManager.EMPTY_AD_BREAK_HOOKS;
    this.adapter.setRuntimeHooks(options.runtimeHooks ?? PlatformManager.EMPTY_RUNTIME_HOOKS);
  }

  static createFromEnvironment(options?: Omit<PlatformManagerOptions, 'adapter'>): PlatformManager {
    return new PlatformManager({
      ...options,
      adapter: PlatformAdapterResolver.create(),
    });
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }
    if (this.initPromise) {
      await this.initPromise;
      return;
    }
    this.initPromise = this.initializeAdapter();
    await this.initPromise;
    this.initPromise = undefined;
  }

  loadingFinished(): void {
    this.adapter.loadingFinished();
  }

  gameplayStart(): void {
    if (this.gameplayRunning) {
      return;
    }
    this.adapter.gameplayStart();
    this.gameplayRunning = true;
  }

  gameplayStop(): void {
    if (!this.gameplayRunning) {
      return;
    }
    this.adapter.gameplayStop();
    this.gameplayRunning = false;
  }

  getId(): string {
    return this.adapter.id;
  }

  shouldMuteAudioOnAdRequest(): boolean { return this.adapter.muteAudioOnAdRequest !== false; }

  isAdvertisingAvailable(): boolean {
    return this.initialized && (this.adapter.isAdvertisingAvailable?.() ?? !['null', 'web'].includes(this.adapter.id));
  }

  reportGameCompletedPercentage(percentage: number): void {
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      throw new RangeError('Game completion percentage must be between 0 and 100');
    }
    this.adapter.reportGameCompletedPercentage?.(percentage);
  }

  setGameContext(context: Readonly<Record<string, string | number | boolean>>): void {
    this.adapter.setGameContext?.(context);
  }

  clearGameContext(): void { this.adapter.clearGameContext?.(); }

  happytime(): void {
    this.adapter.happytime();
  }

  getDataStorageBackend(): PlatformDataStorageBackend | null {
    return this.adapter.getDataStorageBackend();
  }

  getPreferredLocale(): string | null {
    return this.adapter.getPreferredLocale();
  }

  setAdBreakHooks(hooks: PlatformAdBreakHooks): void {
    this.adBreakHooks = hooks;
  }

  setRuntimeHooks(hooks: PlatformRuntimeHooks): void {
    this.adapter.setRuntimeHooks(hooks);
  }

  async prerollBreak(): Promise<void> {
    this.adBreakHooks.onAdBreakStart?.();
    try {
      await this.adapter.prerollBreak();
    } finally {
      this.adBreakHooks.onAdBreakEnd?.();
    }
  }

  async commercialBreak(): Promise<void> {
    this.adBreakHooks.onAdBreakStart?.();
    try {
      await this.adapter.commercialBreak();
    } finally {
      this.adBreakHooks.onAdBreakEnd?.();
    }
  }

  async rewardedBreak(): Promise<PlatformRewardResult> {
    this.adBreakHooks.onAdBreakStart?.();
    try {
      return await this.adapter.rewardedBreak();
    } finally {
      this.adBreakHooks.onAdBreakEnd?.();
    }
  }

  isInitialized(): boolean {
    return this.adapter.isInitialized();
  }

  dispose(): void {
    this.gameplayRunning = false;
    this.adapter.dispose();
  }

  private async initializeAdapter(): Promise<void> {
    try {
      await this.adapter.init();
    } catch {
      // Adapter errors must not crash engine startup.
    }
    this.initialized = true;
  }
}
