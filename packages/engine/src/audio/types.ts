/**
 * Unique identifier of an audio asset.
 * Usually matches the asset id registered in AssetManager.
 */
export type AudioId = string;

/**
 * Logical playback channels used by the high-level audio API.
 */
export type AudioChannel = 'music' | 'sfx';

/**
 * Handle identifying a specific active playback instance.
 */
export type AudioHandle = string;

/**
 * Normalized source descriptor passed to the backend layer.
 */
export interface AudioSourceDescriptor {
  id: AudioId;
  url: string;
}

/**
 * Play options accepted by the high-level audio API.
 */
export interface PlayAudioOptions {
  channel?: AudioChannel;
  loop?: boolean;
  volume?: number;
  rate?: number;
  seekSeconds?: number;
}

/**
 * Audio manager bootstrap options.
 */
export interface AudioManagerOptions {
  channelEnabledByDefault?: Partial<Record<AudioChannel, boolean>>;
  muteWhenPageInactive?: boolean;
  /** Optional map of volume overrides. Keys are either `channel.<name>` or audio ids. Values 0..1. */
  volumeOverrides?: Record<string, number>;
  /** Optional asset id pointing to a JSON config with the same shape as `volumeOverrides`. */
  volumeConfigId?: string;
}

/**
 * Low-level backend contract used by AudioManager.
 * Concrete implementations (for example Howler) stay internal.
 */
export interface AudioBackend {
  createSource(source: AudioSourceDescriptor): void;
  hasSource(id: AudioId): boolean;
  isHandleActive(handle: AudioHandle): boolean;
  /** Actual playback state, excluding queued/blocked requests. */
  isHandlePlaying?(handle: AudioHandle): boolean;
  /** False while Web Audio is suspended; used to discard stale one-shot SFX. */
  isPlaybackReady?(): boolean;
  play(id: AudioId, options?: PlayAudioOptions): AudioHandle;
  pause(handle: AudioHandle): void;
  stop(handle: AudioHandle): void;
  stopAll(channel?: AudioChannel): void;
  setHandleVolume(handle: AudioHandle, volume: number): void;
  setHandleRate(handle: AudioHandle, rate: number): void;
  seekHandle(handle: AudioHandle, seconds: number): void;
  setMasterVolume(volume: number): void;
  setChannelVolume(channel: AudioChannel, volume: number): void;
  setMuted(muted: boolean, channel?: AudioChannel): void;
  unlock(): Promise<void> | void;
  unloadSource(id: AudioId): void;
  /** Optional: set per-source default volume at runtime. */
  setSourceVolume?(id: AudioId, volume: number): void;
  dispose(): void;
}
