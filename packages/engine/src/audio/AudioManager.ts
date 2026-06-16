import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { AudioVolumeConfigDecoder } from './AudioVolumeConfigDecoder';
import { AudioChannelPolicy } from './internal/AudioChannelPolicy';
import { AudioMutePolicy } from './internal/AudioMutePolicy';
import { AudioSourceRegistry } from './internal/AudioSourceRegistry';
import { HowlerAudioBackend } from './internal/HowlerAudioBackend';

import type {
  AudioBackend,
  AudioChannel,
  AudioHandle,
  AudioId,
  AudioManagerOptions,
  PlayAudioOptions,
} from './types';
import type { AssetManager } from '@engine/assets';
import type { ConfigStore } from '@engine/configs';

interface RememberedMusicRequest {
  readonly assetId: AudioId;
  readonly options: PlayAudioOptions;
}

/**
 * High-level audio facade for game runtime.
 */
export class AudioManager {
  private static readonly SOURCE_NAME = 'AudioManager';
  private static readonly MIN_VOLUME = 0;
  private static readonly MAX_VOLUME = 1;
  private static readonly MIN_RATE = 0.5;
  private static readonly MAX_RATE = 4;

  private readonly channelPolicy: AudioChannelPolicy;
  private readonly sourceRegistry: AudioSourceRegistry;
  private readonly mutePolicy: AudioMutePolicy;
  private readonly runtimeMuteWhenPaused: boolean;
  private activeMusicHandle: AudioHandle | undefined;
  private activeMusicAssetId: AudioId | undefined;
  private rememberedMusicRequest: RememberedMusicRequest | undefined;
  private pendingRememberedMusicAssetId: AudioId | undefined;
  private musicVolumeInitialized = false;
  private musicVolumeOverridden = false;
  private disposed = false;

  static createDefault(assets: AssetManager, options?: AudioManagerOptions): AudioManager {
    return new AudioManager(assets, new HowlerAudioBackend(), options);
  }

  constructor(
    assets: AssetManager,
    private readonly backend: AudioBackend,
    options?: AudioManagerOptions,
  ) {
    this.channelPolicy = new AudioChannelPolicy(options?.channelEnabledByDefault);
    this.runtimeMuteWhenPaused = options?.muteWhenPageInactive ?? true;
    this.sourceRegistry = new AudioSourceRegistry(assets, backend, AudioManager.SOURCE_NAME);
    this.mutePolicy = new AudioMutePolicy(backend, {
      onRuntimeResumed: () => this.enforceChannelEnabledPolicy(),
    });
  }

  playMusic(assetId: AudioId, options?: PlayAudioOptions): AudioHandle | undefined {
    const musicOptions = this.mergeMusicOptions(options);
    this.rememberMusicRequest(assetId, musicOptions);
    this.ensureRememberedMusicSourceInBackground(assetId);

    if (!this.isChannelEnabled('music')) {
      this.stopActiveMusicHandle();
      return undefined;
    }

    const activeMusicHandle = this.activeMusicHandle;
    if (
      activeMusicHandle &&
      this.activeMusicAssetId === assetId &&
      this.backend.isHandleActive(activeMusicHandle)
    ) {
      return activeMusicHandle;
    }

    if (activeMusicHandle && !this.backend.isHandleActive(activeMusicHandle)) {
      this.clearActiveMusic();
    }

    if (!this.sourceRegistry.isSourceRegistered(assetId)) {
      return undefined;
    }

    this.sourceRegistry.ensureSourceRegistered(assetId);
    // Keep music single-instance even if the tracked handle was lost out of sync.
    this.backend.stopAll('music');
    this.stopActiveMusicHandle();

    const handle = this.backend.play(assetId, musicOptions);
    this.activeMusicHandle = handle;
    this.activeMusicAssetId = assetId;
    return handle;
  }

  playSfx(assetId: AudioId, options?: PlayAudioOptions): AudioHandle | undefined {
    if (!this.isChannelEnabled('sfx')) {
      return undefined;
    }
    this.sourceRegistry.ensureSourceRegistered(assetId);
    return this.backend.play(assetId, this.mergeSfxOptions(options));
  }

  preloadInBackground(assetId: AudioId): void {
    if (this.disposed) {
      return;
    }
    void this.sourceRegistry.ensureSourceRegisteredInBackground(assetId).catch(() => {
      // Background preload must never block scene flow or create unhandled rejections.
    });
  }

  stopByHandle(handle: AudioHandle): void {
    this.backend.stop(handle);
    if (this.activeMusicHandle === handle) {
      this.clearRememberedMusicRequest();
    }
  }

  pauseByHandle(handle: AudioHandle): void {
    this.backend.pause(handle);
  }

  setHandleVolume(handle: AudioHandle, volume: number): void {
    this.assertVolume(volume, 'AudioManager.setHandleVolume');
    this.backend.setHandleVolume(handle, volume);
  }

  setHandleRate(handle: AudioHandle, rate: number): void {
    this.assertRate(rate, 'AudioManager.setHandleRate');
    this.backend.setHandleRate(handle, rate);
  }

  seekHandle(handle: AudioHandle, seconds: number): void {
    this.assertSeek(seconds, 'AudioManager.seekHandle');
    this.backend.seekHandle(handle, seconds);
  }

  stopAll(channel?: AudioChannel): void {
    this.backend.stopAll(channel);
    if (channel === undefined || channel === 'music') {
      this.clearRememberedMusicRequest();
    }
  }

  setMasterVolume(value: number): void {
    this.assertVolume(value, 'AudioManager.setMasterVolume');
    this.backend.setMasterVolume(value);
  }

  setChannelVolume(channel: AudioChannel, value: number): void {
    this.assertVolume(value, 'AudioManager.setChannelVolume');
    if (channel === 'music') {
      this.musicVolumeInitialized = true;
      this.musicVolumeOverridden = true;
    }
    this.backend.setChannelVolume(channel, value);
  }

  setMusicVolume(value: number): void {
    this.assertVolume(value, 'AudioManager.setMusicVolume');
    this.musicVolumeInitialized = true;
    this.musicVolumeOverridden = true;
    this.backend.setChannelVolume('music', value);
  }

  setMusicVolumeDefault(value: number): void {
    this.assertVolume(value, 'AudioManager.setMusicVolumeDefault');
    if (this.musicVolumeOverridden || this.musicVolumeInitialized) {
      return;
    }
    this.musicVolumeInitialized = true;
    this.backend.setChannelVolume('music', value);
  }

  setMuted(muted: boolean, channel?: AudioChannel): void {
    if (channel !== undefined) {
      this.backend.setMuted(muted, channel);
      return;
    }
    this.mutePolicy.setGlobalMuted(muted);
  }

  applyBootstrapConfig(options: AudioManagerOptions | undefined, configStore: ConfigStore): void {
    if (!options) {
      return;
    }
    if (options.volumeOverrides !== undefined) {
      const decoded = AudioVolumeConfigDecoder.decode(
        options.volumeOverrides,
        "AudioManagerOptions('volumeOverrides')",
      );
      this.applyDecodedVolumeOverrides(decoded);
      return;
    }
    if (options.volumeConfigId === undefined) {
      return;
    }
    const raw = configStore.getRequired(options.volumeConfigId);
    const decoded = AudioVolumeConfigDecoder.decode(
      raw,
      `AudioManager('${options.volumeConfigId}')`,
    );
    this.applyDecodedVolumeOverrides(decoded);
  }

  /** Apply a batch of volume overrides. Keys prefixed with `channel.` affect channels, others are audio ids. */
  applyVolumeOverrides(overrides: Record<string, number>): void {
    const decoded = AudioVolumeConfigDecoder.decode(
      overrides,
      "AudioManager('applyVolumeOverrides')",
    );
    this.applyDecodedVolumeOverrides(decoded);
  }

  private applyDecodedVolumeOverrides(overrides: Readonly<Record<string, number>>): void {
    const setSourceVolume = this.getRequiredSetSourceVolume();
    for (const [key, value] of Object.entries(overrides)) {
      if (key.startsWith('channel.')) {
        const channel = key.slice('channel.'.length) as AudioChannel;
        if (channel === 'music' || channel === 'sfx') {
          this.setChannelVolume(channel, value);
        }
        continue;
      }
      setSourceVolume(key, value);
    }
  }

  setRuntimePaused(paused: boolean): void {
    if (!this.runtimeMuteWhenPaused) {
      return;
    }
    this.mutePolicy.setRuntimeMuted(paused);
  }

  setPlatformMuted(muted: boolean): void {
    this.mutePolicy.setPlatformMuted(muted);
  }

  setMusicEnabled(enabled: boolean): void {
    this.setChannelEnabled('music', enabled);
  }

  setSfxEnabled(enabled: boolean): void {
    this.setChannelEnabled('sfx', enabled);
  }

  setChannelEnabled(channel: AudioChannel, enabled: boolean): void {
    this.channelPolicy.setEnabled(channel, enabled);
    if (enabled) {
      if (channel === 'music') {
        this.restoreRememberedMusicIfNeeded();
      }
      return;
    }
    this.backend.stopAll(channel);
    if (channel === 'music') {
      this.clearActiveMusic();
    }
  }

  isMusicEnabled(): boolean {
    return this.isChannelEnabled('music');
  }

  isSfxEnabled(): boolean {
    return this.isChannelEnabled('sfx');
  }

  isMusicPlaying(): boolean {
    const handle = this.activeMusicHandle;
    if (!handle) {
      return false;
    }
    if (!this.backend.isHandleActive(handle)) {
      this.clearRememberedMusicRequest();
      return false;
    }
    return true;
  }

  unloadSource(id: AudioId): void {
    this.sourceRegistry.unloadSource(id);
    if (this.rememberedMusicRequest?.assetId === id) {
      this.clearRememberedMusicRequest();
      return;
    }
    const activeMusicHandle = this.activeMusicHandle;
    if (!activeMusicHandle) {
      return;
    }
    if (!this.backend.isHandleActive(activeMusicHandle)) {
      this.clearActiveMusic();
    }
  }

  unlock(): Promise<void> {
    return Promise.resolve(this.backend.unlock());
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.clearRememberedMusicRequest();
    this.sourceRegistry.clear();
    this.mutePolicy.dispose();
    this.backend.dispose();
  }

  private stopActiveMusicHandle(): void {
    const handle = this.activeMusicHandle;
    if (!handle) {
      return;
    }
    if (!this.backend.isHandleActive(handle)) {
      this.clearActiveMusic();
      return;
    }

    this.backend.stop(handle);
    this.clearActiveMusic();
  }

  private rememberMusicRequest(assetId: AudioId, options: PlayAudioOptions): void {
    this.rememberedMusicRequest = {
      assetId,
      options,
    };
  }

  private restoreRememberedMusicIfNeeded(): void {
    if (!this.isChannelEnabled('music')) {
      return;
    }

    const rememberedRequest = this.rememberedMusicRequest;
    if (!rememberedRequest) {
      return;
    }

    const activeHandle = this.activeMusicHandle;
    if (activeHandle) {
      if (this.backend.isHandleActive(activeHandle)) {
        return;
      }
      this.clearActiveMusic();
    }

    if (!this.sourceRegistry.isSourceRegistered(rememberedRequest.assetId)) {
      this.ensureRememberedMusicSourceInBackground(rememberedRequest.assetId);
      return;
    }

    this.sourceRegistry.ensureSourceRegistered(rememberedRequest.assetId);
    // Restore must also clear any orphaned music instance before replay.
    this.backend.stopAll('music');
    const handle = this.backend.play(rememberedRequest.assetId, rememberedRequest.options);
    this.activeMusicHandle = handle;
    this.activeMusicAssetId = rememberedRequest.assetId;
  }

  private clearActiveMusic(): void {
    this.activeMusicHandle = undefined;
    this.activeMusicAssetId = undefined;
  }

  private clearRememberedMusicRequest(): void {
    this.clearActiveMusic();
    this.rememberedMusicRequest = undefined;
    this.pendingRememberedMusicAssetId = undefined;
  }

  private ensureRememberedMusicSourceInBackground(assetId: AudioId): void {
    if (this.disposed) {
      return;
    }
    if (this.sourceRegistry.isSourceRegistered(assetId)) {
      return;
    }
    if (this.pendingRememberedMusicAssetId === assetId) {
      return;
    }

    this.pendingRememberedMusicAssetId = assetId;
    void this.sourceRegistry.ensureSourceRegisteredInBackground(assetId)
      .then(() => {
        if (this.disposed) {
          return;
        }
        if (this.pendingRememberedMusicAssetId !== assetId) {
          return;
        }
        const rememberedRequest = this.rememberedMusicRequest;
        if (!rememberedRequest || rememberedRequest.assetId !== assetId) {
          this.pendingRememberedMusicAssetId = undefined;
          return;
        }
        this.pendingRememberedMusicAssetId = undefined;
        this.restoreRememberedMusicIfNeeded();
      })
      .catch(() => {
        if (this.pendingRememberedMusicAssetId === assetId) {
          this.pendingRememberedMusicAssetId = undefined;
        }
      });
  }

  private isChannelEnabled(channel: AudioChannel): boolean {
    return this.channelPolicy.isEnabled(channel);
  }

  private mergeMusicOptions(options?: PlayAudioOptions): PlayAudioOptions {
    if (!options) {
      return { channel: 'music', loop: true };
    }
    return {
      ...options,
      channel: 'music',
      loop: options.loop ?? true,
    };
  }

  private mergeSfxOptions(options?: PlayAudioOptions): PlayAudioOptions {
    if (!options) {
      return { channel: 'sfx', loop: false };
    }
    return {
      ...options,
      channel: 'sfx',
      loop: options.loop ?? false,
    };
  }

  private assertVolume(value: number, source: string): void {
    if (
      !Number.isFinite(value) ||
      value < AudioManager.MIN_VOLUME ||
      value > AudioManager.MAX_VOLUME
    ) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.AudioInvalidArgument,
        subsystem: EngineSubsystem.Audio,
        message: 'Volume must be within allowed range',
        details: {
          source,
          min: AudioManager.MIN_VOLUME,
          max: AudioManager.MAX_VOLUME,
          value: String(value),
        },
      });
    }
  }

  private assertRate(value: number, source: string): void {
    if (!Number.isFinite(value) || value < AudioManager.MIN_RATE || value > AudioManager.MAX_RATE) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.AudioInvalidArgument,
        subsystem: EngineSubsystem.Audio,
        message: 'Rate must be within allowed range',
        details: {
          source,
          min: AudioManager.MIN_RATE,
          max: AudioManager.MAX_RATE,
          value: String(value),
        },
      });
    }
  }

  private assertSeek(value: number, source: string): void {
    if (!Number.isFinite(value) || value < 0) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.AudioInvalidArgument,
        subsystem: EngineSubsystem.Audio,
        message: 'seekSeconds must be a finite non-negative number',
        details: { source, value: String(value) },
      });
    }
  }

  private getRequiredSetSourceVolume(): (id: AudioId, volume: number) => void {
    const setSourceVolume = this.backend.setSourceVolume;
    if (setSourceVolume) {
      return setSourceVolume.bind(this.backend);
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.AudioMissingRequired,
      subsystem: EngineSubsystem.Audio,
      message: 'Audio backend does not support per-source volume updates',
      details: { method: 'AudioManager.getRequiredSetSourceVolume' },
    });
  }

  private enforceChannelEnabledPolicy(): void {
    if (!this.isChannelEnabled('music')) {
      this.backend.stopAll('music');
      this.clearActiveMusic();
    }
    if (!this.isChannelEnabled('sfx')) {
      this.backend.stopAll('sfx');
    }
  }
}
