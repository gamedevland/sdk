import { Howl, Howler } from 'howler';

import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type {
  AudioBackend,
  AudioChannel,
  AudioHandle,
  AudioId,
  AudioSourceDescriptor,
  PlayAudioOptions,
} from '../types';

export class HowlerAudioBackend implements AudioBackend {
  private static readonly DEFAULT_HANDLE_VOLUME = 1;
  private static readonly DEFAULT_HANDLE_RATE = 1;
  private static readonly MIN_VOLUME = 0;
  private static readonly MAX_VOLUME = 1;
  private static readonly MIN_RATE = 0.5;
  private static readonly MAX_RATE = 4;

  private readonly channelVolumes = new Map<AudioChannel, number>([
    ['music', 1],
    ['sfx', 1],
  ]);
  private readonly sourceVolumes = new Map<AudioId, number>();
  private masterVolume = 1;
  private globalMuted = false;
  private readonly channelMuted = new Map<AudioChannel, boolean>([
    ['music', false],
    ['sfx', false],
  ]);
  private readonly musicSourceIds = new Set<AudioId>();
  private readonly sourcesById = new Map<AudioId, SourceRecord>();
  private readonly handles = new Map<AudioHandle, HandleRecord>();
  private handleCounter = 0;
  private disposed = false;

  createSource(source: AudioSourceDescriptor): void {
    if (this.sourcesById.has(source.id)) {
      throw EngineErrorFactory.conflict({
        code: EngineErrorCode.AudioConflict,
        subsystem: EngineSubsystem.Audio,
        message: 'Audio source is already registered',
        details: { id: source.id, method: 'HowlerAudioBackend.createSource' },
      });
    }
    this.sourcesById.set(source.id, { descriptor: { ...source }, howl: this.createSourceHowl(source) });
  }

  hasSource(id: AudioId): boolean {
    return this.sourcesById.has(id);
  }

  isHandleActive(handle: AudioHandle): boolean {
    return this.handles.has(handle);
  }

  isHandlePlaying(handle: AudioHandle): boolean {
    const record = this.handles.get(handle);
    return record !== undefined && record.started && !record.blocked && record.howl.playing(record.soundId);
  }

  isPlaybackReady(): boolean {
    return !Howler.noAudio && (!Howler.usingWebAudio || Howler.ctx?.state === 'running');
  }

  play(id: AudioId, options?: PlayAudioOptions): AudioHandle {
    const howl = this.getRequiredSource(id);
    const channel = options?.channel ?? 'sfx';
    const loop = options?.loop ?? false;
    const requestedVolume =
      options?.volume ?? this.sourceVolumes.get(id) ?? HowlerAudioBackend.DEFAULT_HANDLE_VOLUME;
    const requestedRate = options?.rate ?? HowlerAudioBackend.DEFAULT_HANDLE_RATE;
    this.assertVolume(requestedVolume, 'HowlerAudioBackend.play');
    this.assertRate(requestedRate, 'HowlerAudioBackend.play');
    this.assertOptionalSeek(options?.seekSeconds, 'HowlerAudioBackend.play');

    if (channel === 'music') {
      for (const [handle, record] of this.handles) {
        if (record.channel === 'music' && record.sourceId === id) return handle;
      }
      this.stopAll('music');
      this.musicSourceIds.add(id);
    }

    const soundId = howl.play();
    const handle = this.createHandle(id);
    const onFinish = () => this.removeHandle(handle);
    const record: HandleRecord = {
      sourceId: id,
      channel,
      howl,
      soundId,
      requestedVolume,
      requestedRate,
      started: false,
      blocked: false,
      paused: false,
      onEnd: () => {
        if (!loop) this.removeHandle(handle);
      },
      onFinish,
      onPlay: () => { record.started = true; record.blocked = false; },
      onPlayError: () => {
        if (!this.handles.has(handle)) return;
        if (channel === 'music') {
          record.blocked = true;
          howl.off('unlock', record.onUnlock);
          howl.once('unlock', record.onUnlock);
        } else {
          this.removeHandle(handle);
          howl.stop(soundId);
        }
      },
      onUnlock: () => this.retryMusicRecord(handle, record),
      onLoadError: () => this.removeHandle(handle),
    };
    this.handles.set(handle, record);

    howl.loop(loop, soundId);
    howl.rate(requestedRate, soundId);
    howl.volume(this.resolveEffectiveVolume(record), soundId);
    howl.mute(this.isHandleMuted(record), soundId);
    if (options?.seekSeconds !== undefined) {
      howl.seek(options.seekSeconds, soundId);
    }

    // Loop boundaries keep the handle active; every terminal path releases all listeners.
    howl.on('end', record.onEnd, soundId);
    howl.once('stop', record.onFinish, soundId);
    howl.on('play', record.onPlay, soundId);
    howl.on('playerror', record.onPlayError, soundId);
    howl.once('loaderror', record.onLoadError);

    return handle;
  }

  pause(handle: AudioHandle): void {
    const record = this.getRequiredHandle(handle, 'HowlerAudioBackend.pause');
    record.paused = true;
    record.howl.pause(record.soundId);
  }

  stop(handle: AudioHandle): void {
    const record = this.getRequiredHandle(handle, 'HowlerAudioBackend.stop');
    if (record.channel === 'music' && record.howl.state() !== 'loaded') {
      // Cancel the old Howler queue entirely. A queued stop can otherwise fire
      // against a reused sound id belonging to a later request after decoding.
      this.removeHandle(handle);
      record.howl.unload();
      const source = this.sourcesById.get(record.sourceId);
      if (source && !this.disposed) source.howl = this.createSourceHowl(source.descriptor);
      return;
    }
    record.howl.stop(record.soundId);
    this.removeHandle(handle);
  }

  stopAll(channel?: AudioChannel): void {
    if (channel === undefined) {
      for (const handle of this.handles.keys()) {
        this.stop(handle);
      }
      for (const sourceId of this.musicSourceIds) {
        this.stopMusicSourcePlayback(sourceId);
      }
      return;
    }

    for (const [handle, record] of this.handles) {
      if (record.channel !== channel) {
        continue;
      }
      this.stop(handle);
    }

    if (channel === 'music') {
      for (const sourceId of this.musicSourceIds) {
        this.stopMusicSourcePlayback(sourceId);
      }
    }
  }

  setHandleVolume(handle: AudioHandle, volume: number): void {
    this.assertVolume(volume, 'HowlerAudioBackend.setHandleVolume');
    const record = this.getRequiredHandle(handle, 'HowlerAudioBackend.setHandleVolume');
    record.requestedVolume = volume;
    record.howl.volume(this.resolveEffectiveVolume(record), record.soundId);
  }

  setHandleRate(handle: AudioHandle, rate: number): void {
    this.assertRate(rate, 'HowlerAudioBackend.setHandleRate');
    const record = this.getRequiredHandle(handle, 'HowlerAudioBackend.setHandleRate');
    record.requestedRate = rate;
    record.howl.rate(rate, record.soundId);
  }

  seekHandle(handle: AudioHandle, seconds: number): void {
    this.assertSeek(seconds, 'HowlerAudioBackend.seekHandle');
    const record = this.getRequiredHandle(handle, 'HowlerAudioBackend.seekHandle');
    record.howl.seek(seconds, record.soundId);
  }

  setMasterVolume(volume: number): void {
    this.assertVolume(volume, 'HowlerAudioBackend.setMasterVolume');
    this.masterVolume = volume;
    this.syncAllHandles();
  }

  setChannelVolume(channel: AudioChannel, volume: number): void {
    this.assertVolume(volume, 'HowlerAudioBackend.setChannelVolume');
    this.channelVolumes.set(channel, volume);
    this.syncChannelHandles(channel);
  }

  setMuted(muted: boolean, channel?: AudioChannel): void {
    if (channel === undefined) {
      this.globalMuted = muted;
      Howler.mute(muted);
      this.syncAllHandles();
      if (!muted) this.retryPendingMusic();
      return;
    }
    this.channelMuted.set(channel, muted);
    this.syncChannelHandles(channel);
    if (!muted && channel === 'music') this.retryPendingMusic();
  }

  async unlock(): Promise<void> {
    if (this.disposed) return;
    // Never reuse a suspended autoplay promise: each gesture must call resume()
    // on its own stack. HTML media retries also run before the first await.
    const resumed = this.resumeAudioContextIfNeeded();
    this.retryPendingMusic();
    await resumed;
    if (!this.disposed) this.retryPendingMusic();
  }

  unloadSource(id: AudioId): void {
    this.stopHandlesForSource(id);
    this.getRequiredSource(id).unload();
    this.sourcesById.delete(id);
    this.musicSourceIds.delete(id);
  }

  setSourceVolume(id: AudioId, volume: number): void {
    this.assertVolume(volume, 'HowlerAudioBackend.setSourceVolume');
    this.sourceVolumes.set(id, volume);
    // update active handles for this source
    for (const record of this.handles.values()) {
      if (record.sourceId !== id) continue;
      record.howl.volume(this.resolveEffectiveVolume(record), record.soundId);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopAll();
    for (const source of this.sourcesById.values()) {
      source.howl.unload();
    }
    this.sourcesById.clear();
    this.musicSourceIds.clear();
    this.handles.clear();
  }

  private createHandle(id: AudioId): AudioHandle {
    this.handleCounter += 1;
    return `${id}#${String(this.handleCounter)}`;
  }

  private getRequiredSource(id: AudioId): Howl {
    const source = this.sourcesById.get(id);
    if (source) {
      return source.howl;
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.AudioMissingRequired,
      subsystem: EngineSubsystem.Audio,
      message: 'Audio source is not registered',
      details: { id, method: 'HowlerAudioBackend.getRequiredSource' },
    });
  }

  private getRequiredHandle(handle: AudioHandle, source: string): HandleRecord {
    const record = this.handles.get(handle);
    if (record) {
      return record;
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.AudioMissingRequired,
      subsystem: EngineSubsystem.Audio,
      message: 'Audio handle is not active',
      details: { handle, source, method: 'HowlerAudioBackend.getRequiredHandle' },
    });
  }

  private removeHandle(handle: AudioHandle): void {
    const record = this.handles.get(handle);
    if (!record) return;
    this.handles.delete(handle);
    record.howl.off('end', record.onEnd, record.soundId);
    record.howl.off('stop', record.onFinish, record.soundId);
    record.howl.off('play', record.onPlay, record.soundId);
    record.howl.off('playerror', record.onPlayError, record.soundId);
    record.howl.off('unlock', record.onUnlock);
    record.howl.off('loaderror', record.onLoadError);
  }

  private retryPendingMusic(): void {
    for (const [handle, record] of this.handles) this.retryMusicRecord(handle, record);
  }

  private retryMusicRecord(handle: AudioHandle, record: HandleRecord): void {
    if (this.disposed || !this.handles.has(handle) || record.channel !== 'music' || record.paused
      || this.isHandleMuted(record) || !this.isPlaybackReady() || record.howl.state() !== 'loaded'
      || record.started && !record.blocked || record.howl.playing(record.soundId)) return;
    // Reuse the same sound id, so repeated gestures cannot layer music instances.
    record.howl.play(record.soundId);
  }

  private stopHandlesForSource(sourceId: AudioId): void {
    for (const [handle, record] of this.handles) {
      if (record.sourceId !== sourceId) {
        continue;
      }
      this.stop(handle);
    }
  }

  private stopMusicSourcePlayback(sourceId: AudioId): void {
    const source = this.sourcesById.get(sourceId);
    if (!source) {
      return;
    }
    const howl = source.howl;
    // Only loaded sources can contain orphaned playback. Pending music is
    // cancelled by replacing its source in stop(), never by queuing a global stop.
    if (howl.state() === 'loaded') howl.stop();
    for (const [handle, record] of this.handles) {
      if (record.sourceId !== sourceId || record.channel !== 'music') {
        continue;
      }
      this.removeHandle(handle);
    }
  }

  private resolveEffectiveVolume(record: HandleRecord): number {
    const channelVolume = this.getRequiredChannelVolume(record.channel);
    return record.requestedVolume * channelVolume * this.masterVolume;
  }

  private createSourceHowl(source: AudioSourceDescriptor): Howl {
    return new Howl({ src: [source.url], preload: true });
  }

  private isHandleMuted(record: HandleRecord): boolean {
    return this.globalMuted || this.getRequiredChannelMuted(record.channel);
  }

  private syncChannelHandles(channel: AudioChannel): void {
    for (const record of this.handles.values()) {
      if (record.channel !== channel) {
        continue;
      }
      record.howl.volume(this.resolveEffectiveVolume(record), record.soundId);
      record.howl.mute(this.isHandleMuted(record), record.soundId);
    }
  }

  private getRequiredChannelVolume(channel: AudioChannel): number {
    const value = this.channelVolumes.get(channel);
    if (value !== undefined) {
      return value;
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.AudioMissingRequired,
      subsystem: EngineSubsystem.Audio,
      message: 'Channel volume is not configured',
      details: { channel, method: 'HowlerAudioBackend.getRequiredChannelVolume' },
    });
  }

  private getRequiredChannelMuted(channel: AudioChannel): boolean {
    const value = this.channelMuted.get(channel);
    if (value !== undefined) {
      return value;
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.AudioMissingRequired,
      subsystem: EngineSubsystem.Audio,
      message: 'Channel mute state is not configured',
      details: { channel, method: 'HowlerAudioBackend.getRequiredChannelMuted' },
    });
  }

  private syncAllHandles(): void {
    for (const record of this.handles.values()) {
      record.howl.volume(this.resolveEffectiveVolume(record), record.soundId);
      record.howl.mute(this.isHandleMuted(record), record.soundId);
    }
  }

  private assertVolume(value: number, source: string): void {
    if (!Number.isFinite(value) || value < HowlerAudioBackend.MIN_VOLUME || value > HowlerAudioBackend.MAX_VOLUME) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.AudioInvalidArgument,
        subsystem: EngineSubsystem.Audio,
        message: 'Volume must be within allowed range',
        details: {
          source,
          min: HowlerAudioBackend.MIN_VOLUME,
          max: HowlerAudioBackend.MAX_VOLUME,
          value: String(value),
        },
      });
    }
  }

  private assertRate(value: number, source: string): void {
    if (!Number.isFinite(value) || value < HowlerAudioBackend.MIN_RATE || value > HowlerAudioBackend.MAX_RATE) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.AudioInvalidArgument,
        subsystem: EngineSubsystem.Audio,
        message: 'Rate must be within allowed range',
        details: {
          source,
          min: HowlerAudioBackend.MIN_RATE,
          max: HowlerAudioBackend.MAX_RATE,
          value: String(value),
        },
      });
    }
  }

  private assertOptionalSeek(value: number | undefined, source: string): void {
    if (value === undefined) {
      return;
    }
    this.assertSeek(value, source);
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

  private async resumeAudioContextIfNeeded(): Promise<void> {
    // Initialize the context through Howler's public API, including a first
    // gesture that arrives before any audio asset has been registered.
    Howler.volume();
    if (Howler.noAudio) {
      throw EngineErrorFactory.create({
        code: EngineErrorCode.AudioPlaybackBlocked, subsystem: EngineSubsystem.Audio,
        message: 'Browser audio is unavailable', details: { method: 'HowlerAudioBackend.unlock' },
      });
    }
    if (!Howler.usingWebAudio) {
      return;
    }
    if (Howler.ctx.state === 'running') {
      return;
    }
    await Howler.ctx.resume();
    if (!this.isPlaybackReady()) {
      throw EngineErrorFactory.create({
        code: EngineErrorCode.AudioPlaybackBlocked, subsystem: EngineSubsystem.Audio,
        message: 'Browser audio context is not running',
        details: { state: Howler.ctx.state, method: 'HowlerAudioBackend.unlock' },
      });
    }
  }
}

interface SourceRecord {
  readonly descriptor: AudioSourceDescriptor;
  howl: Howl;
}

interface HandleRecord {
  sourceId: AudioId;
  channel: AudioChannel;
  howl: Howl;
  soundId: number;
  requestedVolume: number;
  requestedRate: number;
  started: boolean;
  blocked: boolean;
  paused: boolean;
  readonly onEnd: () => void;
  readonly onFinish: () => void;
  readonly onPlay: () => void;
  readonly onPlayError: () => void;
  readonly onUnlock: () => void;
  readonly onLoadError: () => void;
}
